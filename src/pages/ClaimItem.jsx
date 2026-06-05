import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { generateVerificationQuestions, evaluateClaimAnswers } from '../agents/claimVerificationAgent';
import {
  Bot, Brain, CheckCircle, XCircle, Loader, ArrowLeft,
  ShieldCheck, AlertTriangle, ClipboardList, Send
} from 'lucide-react';
import './ClaimItem.css';

/* ── Score Verdict Display ────────────────────────────────────────── */
const VerdictBadge = ({ verdict, score }) => {
  const config = {
    verified:   { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: ShieldCheck,    label: 'Ownership Verified' },
    likely:     { color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  icon: CheckCircle,   label: 'Likely Owner'       },
    uncertain:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: AlertTriangle, label: 'Uncertain'          },
    suspicious: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: XCircle,       label: 'Suspicious Claim'   },
  };
  const c = config[verdict] || config.uncertain;
  const Icon = c.icon;
  return (
    <div className="verdict-badge" style={{ backgroundColor: c.bg, color: c.color, borderColor: c.color + '44' }}>
      <Icon size={18} />
      <span>{c.label}</span>
      <span className="verdict-score">{score}/100</span>
    </div>
  );
};

/* ── Step Indicator ───────────────────────────────────────────────── */
const StepBar = ({ step }) => {
  const steps = ['Item Info', 'AI Questions', 'Your Answers', 'Verification'];
  return (
    <div className="step-bar">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div className={`step-item ${i + 1 <= step ? 'active' : ''} ${i + 1 < step ? 'done' : ''}`}>
            <div className="step-circle">
              {i + 1 < step ? <CheckCircle size={14} /> : <span>{i + 1}</span>}
            </div>
            <span className="step-label">{s}</span>
          </div>
          {i < steps.length - 1 && <div className={`step-line ${i + 1 < step ? 'done' : ''}`} />}
        </React.Fragment>
      ))}
    </div>
  );
};

/* ── Main ClaimItem Page ──────────────────────────────────────────── */
const ClaimItem = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [step, setStep] = useState(1);          // 1: load, 2: questions, 3: answers, 4: result
  const [item, setItem] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState('');
  const [existingClaim, setExistingClaim] = useState(null);

  useEffect(() => {
    loadItemAndCheck();
  }, [id, type]);

  const loadItemAndCheck = async () => {
    try {
      setLoadingMsg('Loading item details...');
      const table = type === 'lost' ? 'lost_items' : 'found_items';
      const { data: itemData, error: itemErr } = await supabase
        .from(table).select('*').eq('id', id).single();
      if (itemErr) throw itemErr;
      setItem(itemData);

      // Check if user already has a pending claim for this item
      const { data: claimData } = await supabase
        .from('claims')
        .select('*')
        .eq('item_id', id)
        .eq('claimant_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (claimData) {
        setExistingClaim(claimData);
        // Restore state from existing claim
        if (claimData.status !== 'pending_questions') {
          setQuestions(claimData.questions || []);
          setAnswers(claimData.answers || []);
          if (claimData.verification_score !== null) {
            setEvaluation({
              score: claimData.verification_score,
              verdict: claimData.ai_verdict,
              reasoning: claimData.ai_reasoning,
              per_question: claimData.per_question_scores || [],
            });
            setStep(4);
          } else {
            setStep(3);
          }
        } else {
          await generateQuestions(itemData);
        }
      } else {
        setLoadingMsg('');
        setStep(1);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMsg('');
    }
  };

  const generateQuestions = async (itemData = item) => {
    try {
      setLoadingMsg('🤖 AI is generating verification questions...');
      setStep(2);

      const result = await generateVerificationQuestions(itemData);
      if (!result.success) throw new Error('Failed to generate questions');

      setQuestions(result.questions);
      setAnswers(new Array(result.questions.length).fill(''));

      // Store claim with questions in Supabase
      const { data: claim, error: claimErr } = await supabase
        .from('claims')
        .insert([{
          item_id: id,
          item_type: type,
          claimant_id: user.id,
          owner_id: itemData.user_id,
          questions: result.questions,
          status: 'pending_questions',
        }])
        .select()
        .single();

      if (claimErr) throw claimErr;
      setExistingClaim(claim);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMsg('');
    }
  };

  const handleAnswerChange = (idx, val) => {
    setAnswers(prev => prev.map((a, i) => i === idx ? val : a));
  };

  const submitAnswers = async () => {
    if (answers.some(a => !a.trim())) {
      setError('Please answer all questions before submitting.');
      return;
    }
    setError('');
    setLoadingMsg('🧠 AI is evaluating your answers...');
    setStep(4);

    try {
      const result = await evaluateClaimAnswers(item, questions, answers);

      // Update claim in Supabase
      await supabase.from('claims').update({
        answers,
        verification_score: result.score,
        ai_verdict: result.verdict,
        ai_reasoning: result.reasoning,
        per_question_scores: result.per_question || [],
        status: 'pending_review',
      }).eq('id', existingClaim.id);

      // Notify item owner
      const claimantName = profile?.name || user?.email;
      await supabase.from('notifications').insert([{
        user_id: item.user_id,
        message: `🔐 ${claimantName} has submitted a claim for your ${type} item "${item.title}" with a verification score of ${result.score}/100. Review it in the Admin panel.`,
        is_read: false,
      }]);

      setEvaluation(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMsg('');
    }
  };

  const scoreColor = (s) => {
    if (s >= 75) return '#10b981';
    if (s >= 50) return '#f59e0b';
    return '#ef4444';
  };

  if (loadingMsg) {
    return (
      <div className="claim-loading">
        <div className="claim-spinner"><Brain size={32} /></div>
        <p className="heading-3 mt-4">{loadingMsg}</p>
      </div>
    );
  }

  return (
    <div className="claim-page animate-fade-in">
      {/* Header */}
      <div className="claim-header glass">
        <button onClick={() => navigate(-1)} className="btn-secondary flex items-center gap-2" style={{ padding: '0.5rem 1rem' }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="claim-header-title">
          <div className="claim-ai-icon"><Brain size={22} /></div>
          <div>
            <h1 className="heading-2">AI Claim Verification</h1>
            <p className="text-small">Claiming: <strong>{item?.title}</strong></p>
          </div>
        </div>
      </div>

      <StepBar step={step} />

      {/* Error Banner */}
      {error && (
        <div className="claim-error glass">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* STEP 1: Start claim */}
      {step === 1 && item && (
        <div className="claim-card glass">
          <div className="claim-intro-icon"><ClipboardList size={32} /></div>
          <h2 className="heading-3">Start Ownership Verification</h2>
          <p className="text-body">
            Our AI will generate <strong>3 personalized questions</strong> that only the true owner of this item can answer.
            Your answers will be scored and reviewed by an admin before the claim is approved.
          </p>

          <div className="claim-item-preview glass">
            <div className="claim-item-img" style={{
              backgroundImage: item.image_url ? `url(${item.image_url})` : 'none',
              backgroundColor: item.image_url ? 'transparent' : 'var(--border-color)'
            }}>
              {!item.image_url && <span className="text-small">No Image</span>}
            </div>
            <div className="claim-item-meta">
              <h3 className="heading-3">{item.title}</h3>
              <p className="text-small mt-1"><strong>Category:</strong> {item.category}</p>
              <p className="text-small"><strong>Location:</strong> {item.location}</p>
            </div>
          </div>

          <button onClick={() => generateQuestions()} className="btn-primary claim-start-btn">
            <Bot size={18} /> Generate Verification Questions
          </button>
        </div>
      )}

      {/* STEP 2: Generating (handled by loadingMsg) */}

      {/* STEP 3: Answer questions */}
      {step === 3 && (
        <div className="claim-card glass">
          <div className="questions-header">
            <Bot size={20} className="ai-icon-inline" />
            <h2 className="heading-3">Answer Verification Questions</h2>
          </div>
          <p className="text-body mb-4">
            Answer these questions honestly. Only the true owner will know these details. Vague or wrong answers will lower your verification score.
          </p>

          <div className="questions-list">
            {questions.map((q, idx) => (
              <div key={idx} className="question-block glass">
                <div className="question-label">
                  <span className="q-num">Q{idx + 1}</span>
                  <p className="q-text">{q}</p>
                </div>
                <textarea
                  className="input-field answer-input"
                  rows={3}
                  placeholder="Type your answer here..."
                  value={answers[idx] || ''}
                  onChange={e => handleAnswerChange(idx, e.target.value)}
                />
              </div>
            ))}
          </div>

          <button onClick={submitAnswers} className="btn-primary claim-start-btn">
            <Send size={18} /> Submit Answers for AI Evaluation
          </button>
        </div>
      )}

      {/* STEP 4: Results */}
      {step === 4 && evaluation && (
        <div className="claim-card glass">
          {/* Score gauge */}
          <div className="score-display">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border-color)" strokeWidth="10" />
              <circle cx="60" cy="60" r="50" fill="none"
                stroke={scoreColor(evaluation.score)}
                strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - evaluation.score / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
                style={{ transition: 'stroke-dashoffset 1.2s ease' }}
              />
            </svg>
            <div className="score-center">
              <span className="score-big">{evaluation.score}</span>
              <span className="score-label">/ 100</span>
            </div>
          </div>

          <VerdictBadge verdict={evaluation.verdict} score={evaluation.score} />

          {/* AI Reasoning */}
          <div className="reasoning-box glass">
            <div className="reasoning-header"><Bot size={16} /> AI Evaluation Summary</div>
            <p className="text-body">{evaluation.reasoning}</p>
          </div>

          {/* Per-question breakdown */}
          {evaluation.per_question?.length > 0 && (
            <div className="per-question-wrap">
              <h3 className="section-sub-heading">Question-by-Question Breakdown</h3>
              {evaluation.per_question.map((pq, i) => (
                <div key={i} className="pq-row glass">
                  <div className="pq-top">
                    <span className="pq-q"><strong>Q{i + 1}:</strong> {pq.question}</span>
                    <span className="pq-score-badge" style={{ color: scoreColor(pq.score * 10), backgroundColor: scoreColor(pq.score * 10) + '18' }}>
                      {pq.score}/10
                    </span>
                  </div>
                  <p className="pq-a text-small"><em>Your answer:</em> {answers[i] || '—'}</p>
                  <p className="pq-comment text-small">{pq.comment}</p>
                  {/* Mini progress bar */}
                  <div className="pq-bar-bg">
                    <div className="pq-bar-fill" style={{ width: `${pq.score * 10}%`, backgroundColor: scoreColor(pq.score * 10) }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="claim-result-footer">
            <p className="text-small text-center" style={{ color: 'var(--text-secondary)' }}>
              Your claim has been submitted for admin review. You'll receive a notification once a decision is made.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClaimItem;
