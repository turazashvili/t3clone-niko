# T3.chat Clone – Cloneathon Submission

## 🚀 Project Overview

This repository is a submission for [cloneathon.t3.chat](https://cloneathon.t3.chat), showcasing a modern, fully serverless chat platform inspired by T3.chat. The project demonstrates how to build a scalable, real-time chat app using the latest web technologies and a 100% serverless backend powered by Supabase.

---

## 🌟 Key Features

- **100% Serverless**: No custom backend servers—everything runs on Supabase and serverless functions.
- **Multi-LLM Support**: Chat with multiple large language models (OpenAI, Anthropic, Google, and more).
- **Supabase Auth**: Secure authentication and user management with Supabase Auth.
- **Real-Time Sync Engine**: Chats and messages sync instantly across devices using Supabase Realtime.
- **Supabase Storage**: Upload and share images or PDFs directly in chat, stored securely in Supabase Storage.
- **Chat Sharing**: Share conversations with a public link.
- **Web Search Integration**: Optionally enhance chats with real-time web search.
- **Mobile Responsive**: Fully responsive UI for desktop and mobile.
- **Syntax Highlighting**: Beautiful code formatting for technical conversations.

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS, shadcn/ui
- **Backend/Infra**: Supabase (Auth, Database, Storage, Realtime)
- **Serverless Functions**: For LLM proxying and chat logic

---

## 🏗️ Architecture

- **Frontend**: Handles all UI, chat logic, and LLM selection. Communicates with Supabase for authentication, storage, and real-time updates.
- **Supabase**: 
  - **Auth**: Manages user sign-in/sign-up and session management.
  - **Database**: Stores chats, messages, and user metadata.
  - **Storage**: Handles file uploads (images, PDFs) attached to messages.
  - **Realtime**: Powers the sync engine for instant updates across devices.
- **Serverless Functions**: Used for securely proxying requests to LLM APIs and handling advanced chat logic.

---

## 🧑‍💻 Running Locally

1. **Clone the repository:**
   ```sh
   git clone <your-fork-url>
   cd t3clone-niko
   ```
2. **Install dependencies:**
   ```sh
   npm install
   # or
   pnpm install
   ```
3. **Set up environment variables:**
   - Copy `.env.example` to `.env` and fill in your Supabase project credentials.
4. **Start the development server:**
   ```sh
   npm run dev
   ```
5. **Open [http://localhost:5173](http://localhost:5173) in your browser.**

---

## 📦 Deployment

This project is optimized for Vercel, Netlify, or any static hosting provider. All backend logic is handled by Supabase and serverless functions.

---

## 🤝 Credits

- Inspired by [T3.chat](https://t3.chat)
- Built for [cloneathon.t3.chat](https://cloneathon.t3.chat)
- Powered by [Supabase](https://supabase.com)

---

## 📄 License

MIT
