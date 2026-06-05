import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useSupabaseUpload } from '../hooks/useSupabaseUpload';
import { useToast } from '../components/ui/Toast';
import { runAgentPipeline } from '../agents/agentPipeline';
import { compressImage, formatFileSize } from '../utils/imageCompression';
import { validateForm, validators, sanitize } from '../utils/validation';
import { checkRateLimit } from '../utils/rateLimiter';
import {
  AlertCircle, CheckCircle, Bot, Loader, Upload,
  ImageIcon, X, Info
} from 'lucide-react';
import './ReportForm.css';

const CATEGORIES = ['Electronics', 'Accessories', 'Personal', 'Clothing', 'Books', 'Sports', 'Other'];
const TODAY = new Date().toISOString().split('T')[0];

const SCHEMA = {
  title:       [validators.required, validators.minLength(3), validators.maxLength(100)],
  description: [validators.required, validators.minLength(10), validators.maxLength(1000)],
  category:    [validators.required],
  location:    [validators.required, validators.minLength(3)],
  date_lost:   [validators.date],
};

const ReportLostItem = () => {
  const { user } = useAuth();
  const toast    = useToast();
  const navigate = useNavigate();
  const { uploadImage, uploading } = useSupabaseUpload('lost-found-images');
  const fileRef = useRef(null);

  const [formData, setFormData] = useState({
    title: '', description: '', category: 'Electronics',
    color: '', location: '', date_lost: ''
  });
  const [errors, setErrors]     = useState({});
  const [touched, setTouched]   = useState({});
  const [file, setFile]         = useState(null);
  const [preview, setPreview]   = useState('');
  const [compressing, setCompressing] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [aiProgress, setAiProgress]   = useState(null);
  const [aiDone, setAiDone]     = useState(false);
  const [submitted, setSubmitted] = useState(false);

  React.useEffect(() => {
    const prefill = sessionStorage.getItem('ai_prefill');
    if (prefill) {
      try {
        const data = JSON.parse(prefill);
        setFormData(prev => ({
          ...prev,
          category: data.category || prev.category,
          color: data.color || prev.color,
          location: data.location || prev.location
        }));
        sessionStorage.removeItem('ai_prefill');
      } catch (e) {
        console.error('Failed to parse prefill', e);
      }
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Validate on change after first touch
    if (touched[name]) {
      const { errors: newErrors } = validateForm({ [name]: value }, { [name]: SCHEMA[name] || [] });
      setErrors(prev => ({ ...prev, [name]: newErrors[name] }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const { errors: newErrors } = validateForm({ [name]: value }, { [name]: SCHEMA[name] || [] });
    setErrors(prev => ({ ...prev, [name]: newErrors[name] }));
  };

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    const sizeErr  = validators.fileSize(5)(selected);
    const typeErr  = validators.fileType(selected);
    if (sizeErr || typeErr) {
      toast.error(sizeErr || typeErr);
      return;
    }

    setCompressing(true);
    try {
      const compressed = await compressImage(selected);
      setFile(compressed);
      setPreview(URL.createObjectURL(compressed));
      toast.success(`Image compressed: ${formatFileSize(selected.size)} → ${formatFileSize(compressed.size)}`);
    } catch {
      toast.warning('Could not compress image. Using original.');
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    } finally {
      setCompressing(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Full validation
    setTouched(Object.keys(SCHEMA).reduce((acc, k) => ({ ...acc, [k]: true }), {}));
    const { errors: validationErrors, isValid } = validateForm(formData, SCHEMA);
    setErrors(validationErrors);
    if (!isValid) { toast.error('Please fix the form errors before submitting.'); return; }

    // Rate limiting
    const rateCheck = checkRateLimit(`report-lost-${user.id}`, 5, 60_000);
    if (!rateCheck.allowed) { toast.error(rateCheck.error); return; }

    setLoading(true);
    setAiProgress(null);
    setAiDone(false);

    try {
      // Sanitize inputs
      const sanitized = {
        title:       sanitize(formData.title),
        description: sanitize(formData.description),
        category:    formData.category,
        color:       sanitize(formData.color),
        location:    sanitize(formData.location),
        date_lost:   formData.date_lost,
      };

      let imageUrl = null;
      if (file) {
        imageUrl = await uploadImage(file);
        if (!imageUrl) throw new Error('Image upload failed. Please try again.');
      }

      const { data: newItem, error } = await supabase
        .from('lost_items')
        .insert([{ ...sanitized, image_url: imageUrl, user_id: user.id, status: 'active' }])
        .select()
        .single();

      if (error) throw error;

      setSubmitted(true);
      toast.success('Lost item reported! Running AI agents...');
      setLoading(false);

      // Run AI pipeline
      await runAgentPipeline(newItem, 'lost', ({ message }) => setAiProgress(message));
      setAiDone(true);
      setAiProgress('🎉 AI pipeline complete! Check the Match Center for results.');
      toast.success('AI agents finished! Check the Match Center.');

      // Reset
      setFormData({ title: '', description: '', category: 'Electronics', color: '', location: '', date_lost: '' });
      clearFile();
      setErrors({});
      setTouched({});

    } catch (err) {
      toast.error(err.message || 'Failed to report item. Please try again.');
      setLoading(false);
    }
  };

  const Field = ({ name, label, required, error }) => (
    <div className="form-field-error" role="alert" aria-live="polite">
      {error && <><AlertCircle size={13} />{error}</>}
    </div>
  );

  return (
    <div className="report-form-page">
      <div className="report-form-container glass">
        <div className="form-header">
          <h1 className="heading-2">Report Lost Item</h1>
          <p className="text-body">Provide details about what you lost. Our AI agents will automatically search for matches.</p>
        </div>

        {/* AI Progress */}
        {aiProgress && (
          <div className={`ai-progress-banner ${aiDone ? 'done' : 'running'}`} role="status" aria-live="polite">
            {aiDone ? <CheckCircle size={20} /> : <Loader size={20} className="spin" />}
            <span>{aiProgress}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="report-form" noValidate aria-label="Report Lost Item Form">
          <div className="form-grid">

            {/* Title */}
            <div className={`form-group full-width ${errors.title ? 'has-error' : ''}`}>
              <label htmlFor="r-title">Item Title <span aria-label="required">*</span></label>
              <input id="r-title" type="text" name="title" value={formData.title}
                onChange={handleChange} onBlur={handleBlur}
                className={`input-field ${errors.title ? 'input-error' : ''}`}
                placeholder="e.g., MacBook Pro 14-inch Silver"
                aria-required="true" aria-describedby={errors.title ? 'title-error' : undefined}
                maxLength={100} />
              {errors.title && <div id="title-error" className="form-field-error"><AlertCircle size={13} />{errors.title}</div>}
            </div>

            {/* Category */}
            <div className={`form-group ${errors.category ? 'has-error' : ''}`}>
              <label htmlFor="r-category">Category <span aria-label="required">*</span></label>
              <select id="r-category" name="category" value={formData.category}
                onChange={handleChange} onBlur={handleBlur}
                className="input-field" aria-required="true">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Color */}
            <div className="form-group">
              <label htmlFor="r-color">Color</label>
              <input id="r-color" type="text" name="color" value={formData.color}
                onChange={handleChange} className="input-field"
                placeholder="e.g., Black, Silver, Blue" maxLength={50} />
            </div>

            {/* Description */}
            <div className={`form-group full-width ${errors.description ? 'has-error' : ''}`}>
              <label htmlFor="r-desc">Description <span aria-label="required">*</span></label>
              <textarea id="r-desc" name="description" value={formData.description}
                onChange={handleChange} onBlur={handleBlur}
                className={`input-field ${errors.description ? 'input-error' : ''}`}
                rows={4} maxLength={1000}
                placeholder="Include any unique identifying features, stickers, damage, serial numbers, etc."
                aria-required="true" aria-describedby={errors.description ? 'desc-error' : undefined} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {errors.description
                  ? <div id="desc-error" className="form-field-error"><AlertCircle size={13} />{errors.description}</div>
                  : <span />}
                <span className="char-count">{formData.description.length}/1000</span>
              </div>
            </div>

            {/* Location */}
            <div className={`form-group ${errors.location ? 'has-error' : ''}`}>
              <label htmlFor="r-loc">Last Known Location <span aria-label="required">*</span></label>
              <input id="r-loc" type="text" name="location" value={formData.location}
                onChange={handleChange} onBlur={handleBlur}
                className={`input-field ${errors.location ? 'input-error' : ''}`}
                placeholder="e.g., Main Library 2nd Floor"
                aria-required="true" maxLength={200} />
              {errors.location && <div className="form-field-error"><AlertCircle size={13} />{errors.location}</div>}
            </div>

            {/* Date */}
            <div className={`form-group ${errors.date_lost ? 'has-error' : ''}`}>
              <label htmlFor="r-date">Date Lost <span aria-label="required">*</span></label>
              <input id="r-date" type="date" name="date_lost" value={formData.date_lost}
                onChange={handleChange} onBlur={handleBlur}
                className={`input-field ${errors.date_lost ? 'input-error' : ''}`}
                max={TODAY} aria-required="true" />
              {errors.date_lost && <div className="form-field-error"><AlertCircle size={13} />{errors.date_lost}</div>}
            </div>

            {/* Image Upload */}
            <div className="form-group full-width">
              <label>Image <span className="optional-label">(optional, auto-compressed)</span></label>
              {preview ? (
                <div className="image-preview-wrap">
                  <img src={preview} alt="Item preview" className="image-preview" />
                  <button type="button" onClick={clearFile} className="image-clear-btn" aria-label="Remove image">
                    <X size={18} />
                  </button>
                  <p className="text-small mt-1" style={{ color: 'var(--success)' }}>
                    ✓ {file?.name} ({formatFileSize(file?.size || 0)})
                  </p>
                </div>
              ) : (
                <label className="file-upload-zone" htmlFor="r-file">
                  {compressing ? <Loader size={24} className="spin" /> : <ImageIcon size={24} />}
                  <span>{compressing ? 'Compressing...' : 'Click to upload or drag an image'}</span>
                  <span className="text-small">JPEG, PNG, WebP — max 5MB</span>
                  <input id="r-file" ref={fileRef} type="file" accept="image/*"
                    onChange={handleFileChange} style={{ display: 'none' }}
                    aria-label="Upload item image" />
                </label>
              )}
            </div>
          </div>

          <div className="ai-note" role="note">
            <Bot size={16} aria-hidden="true" />
            <span>After submission, AI agents will automatically analyze your item and search for potential matches.</span>
          </div>

          <button type="submit" disabled={loading || uploading || compressing}
            className="btn-primary submit-btn"
            aria-label={loading ? 'Submitting...' : 'Submit and run AI agents'}>
            {(loading || uploading) ? (
              <><Loader size={18} className="spin" aria-hidden="true" /> Submitting...</>
            ) : (
              <><Bot size={18} aria-hidden="true" /> Submit &amp; Run AI Agents</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ReportLostItem;
