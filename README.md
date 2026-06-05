# 🎓 Campus Lost & Found Portal

A modern, full-stack web application designed to help university students easily report, search for, and recover lost items on campus. The platform uses an advanced **Agentic AI Pipeline** to automatically match lost and found items, saving students time and increasing recovery rates.

## 🌟 Project Overview
This platform eliminates the hassle of physical lost-and-found boxes by providing a centralized digital hub. Users can instantly report items, chat securely with finders, and rely on an intelligent AI assistant to handle metadata extraction and security verification.

## ✨ Features
- **Intuitive Reporting Flow**: Easy-to-use forms for reporting lost and found items with automatic image compression.
- **Smart Match Center**: A Tinder-style swipe interface to review potential matches.
- **Real-Time Chat**: Secure, real-time messaging between users powered by Supabase WebSockets.
- **Admin Dashboard**: Centralized hub for administrators to verify claims and resolve disputes.
- **Advanced Analytics**: Real-time charts visualizing recovery rates, campus hotspots, and category trends.

## 🤖 AI Features
- **AI Matchmaking**: Extracts metadata (color, category, brand) from descriptions to calculate probability scores between items.
- **Floating AI Assistant**: A conversational bot that interprets natural language (e.g., "I lost my blue wallet at the library") and automatically pre-fills forms.
- **Smart Claim Verification**: Generates dynamic security questions based on hidden item details to securely verify ownership.
- **Smart Notifications**: Actionable alerts that guide users to matches when confidence exceeds 80%.

## 🧠 Agentic Workflow
The project implements a sophisticated multi-agent architecture powered by Groq (Llama-3):
1. **Item Analysis Agent**: Extracts keywords and identifiers.
2. **Matching Agent**: Calculates probability scores continuously in the background.
3. **Notification Agent**: Fires real-time alerts for high-probability matches.
4. **Verification Agent**: Evaluates security questions against user answers.
5. **Insights Agent**: Scours platform analytics to generate actionable recommendations for admins.

## 🛠️ Tech Stack
- **Frontend**: React 19, Vite, React Router v7, Recharts
- **Styling**: Vanilla CSS, Glassmorphism UI
- **Backend/Database**: Supabase (PostgreSQL, Auth, Real-Time Subscriptions, Storage)
- **AI/LLM**: Groq API (Llama-3-8b-8192)

## 🚀 Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/dev-sahilraj/Campus-Lost-Found-Portal.git
   cd Campus-Lost-Found-Portal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Environment Variables**
   To run locally, create a .env file using the values from .env.example.
   
   *Note: Never commit your actual `.env` file. It is safely ignored in `.gitignore`.*

4. **Run the Development Server**
   ```bash
   npm run dev
   ```

## 🔐 Environment Variables Required
The following environment variables are required in your `.env` file:
- `VITE_SUPABASE_URL`: Your Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Your Supabase public anon key.
- `GROQ_API_KEY`: Your Groq AI API key.

## 🌍 Deployment Guide
This project is fully optimized for deployment on platforms like Vercel or Netlify.
1. Push your repository to GitHub.
2. Import the project into Vercel/Netlify.
3. Add the 3 required environment variables in the deployment dashboard.
4. Deploy! The build script (`npm run build`) is fully configured via Vite.

---
*Developed for Campus Deployment | 2026*
