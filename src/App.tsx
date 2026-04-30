import { motion, AnimatePresence } from 'motion/react';
import { Settings, Check, X, Key, Eye, EyeOff, Send, ChevronDown, History, MessageSquare, Plus, Bot, User, Clock, Leaf, Mic, Hexagon, Paperclip, Image as ImageIcon, File, Camera } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

const AI_MODELS = {
  ChatGPT: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  Gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-pro-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  Claude: ['claude-3.7-sonnet', 'claude-3.5-sonnet', 'claude-3-opus', 'claude-3-haiku'],
  OpenRouter: ['auto:-any-', 'anthropic/claude-3.7-sonnet', 'google/gemini-2.5-pro', 'meta-llama/llama-3.3-70b-instruct', 'deepseek/deepseek-r1']
};

type ModelName = keyof typeof AI_MODELS;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  modelInfo?: string;
  imageUrl?: string;
}

interface HistorySession {
  id: string;
  date: number;
  title: string;
  messages: Message[];
}

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelName>('Gemini');
  const [selectedVersion, setSelectedVersion] = useState(AI_MODELS['Gemini'][0]);
  const [showKey, setShowKey] = useState(false);
  const [isPillAnimDone, setIsPillAnimDone] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCameraOpen) {
      setCameraError(null);
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error("Error accessing camera", err);
          setCameraError(err.message || "Permission denied");
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraOpen]);

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setAttachedImage(dataUrl);
        setIsCameraOpen(false);
      }
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
        setIsAttachmentMenuOpen(false);
      }
    }
    
    if (isAttachmentMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAttachmentMenuOpen]);
  
  const [history, setHistory] = useState<HistorySession[]>(() => {
    try {
      const saved = localStorage.getItem('ai_chat_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [apiKeys, setApiKeys] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('ai_api_keys');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ChatGPT: '', Gemini: '', Claude: '', OpenRouter: '', ...parsed };
      }
      return { ChatGPT: '', Gemini: '', Claude: '', OpenRouter: '' };
    } catch {
      return { ChatGPT: '', Gemini: '', Claude: '', OpenRouter: '' };
    }
  });

  useEffect(() => {
    localStorage.setItem('ai_api_keys', JSON.stringify(apiKeys));
  }, [apiKeys]);

  useEffect(() => {
    localStorage.setItem('ai_chat_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleModelSelect = (model: ModelName) => {
    setSelectedModel(model);
    setSelectedVersion(AI_MODELS[model][0]);
    setShowKey(false);
  };

  const handleSend = () => {
    if ((!prompt.trim() && !attachedImage) || isSubmitting) return;

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    const currentPrompt = prompt.trim();
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', content: currentPrompt, imageUrl: attachedImage || undefined };
    const updatedMessages = [...messages, newUserMsg];
    
    setMessages(updatedMessages);
    setPrompt('');
    setAttachedImage(null);
    setIsSubmitting(true);

    const apiKey = apiKeys[selectedModel];

    const finalizeResponse = (assistantContent: string) => {
      const newAssistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        modelInfo: `${selectedModel} - ${selectedVersion}`
      };
      
      const finalMessages = [...updatedMessages, newAssistantMsg];
      setMessages(finalMessages);
      setIsSubmitting(false);

      setHistory(prev => {
        const newHistory = [...prev];
        let sid = currentSessionId;
        
        if (!sid) {
          sid = Date.now().toString();
          setCurrentSessionId(sid);
          newHistory.unshift({
            id: sid,
            date: Date.now(),
            title: currentPrompt.slice(0, 30) + (currentPrompt.length > 30 ? '...' : ''),
            messages: finalMessages
          });
        } else {
          const index = newHistory.findIndex(h => h.id === sid);
          if (index !== -1) {
            newHistory[index].messages = finalMessages;
          }
        }
        return newHistory;
      });
    };

    if (!apiKey) {
      setTimeout(() => {
        finalizeResponse(`This is a simulated ${selectedModel} response (${selectedVersion}). To connect real AI, please enter your API key in the settings.`);
      }, 1200);
      return;
    }

    // Actual API Integration
    const fetchAI = async () => {
      try {
        let endpoint = '';
        let headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        let body: any = {};

        // Convert message history to API format
        const apiMessages = updatedMessages.map(m => ({
          role: m.role,
          content: m.content
        }));

        if (selectedModel === 'OpenRouter') {
          endpoint = 'https://openrouter.ai/api/v1/chat/completions';
          headers['HTTP-Referer'] = window.location.href;
          headers['X-Title'] = 'AI Leaf';
          body = {
            model: selectedVersion,
            messages: apiMessages
          };
        } else {
          // If we want to support other providers later, we can add them here.
          // For now, if it's not OpenRouter, just show simulated.
          setTimeout(() => {
            finalizeResponse(`Real integration for ${selectedModel} is not fully set up yet. OpenRouter is currently supported.`);
          }, 1200);
          return;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("API Error:", errorText);
          finalizeResponse(`Error: Failed to fetch response from ${selectedModel}. Please check your API key and try again.`);
          return;
        }

        const data = await response.json();
        
        if (selectedModel === 'OpenRouter') {
          finalizeResponse(data.choices[0].message.content);
        }
      } catch (err) {
        console.error("API call failed:", err);
        finalizeResponse(`Error: Could not connect to ${selectedModel}. Please check your internet connection.`);
      }
    };

    fetchAI();
  };

  const loadSession = (session: HistorySession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setIsSidebarOpen(false);
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setIsSidebarOpen(false);
  };

  const toggleRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsRecording(false);
    } else {
      // Always create a fresh instance to avoid history leakage between sessions
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;

      // Keep track of the initially existing prompt cleanly
      const initialPrompt = prompt ? prompt + (prompt.endsWith(' ') ? '' : ' ') : '';
      let sessionFinalTranscript = '';
      
      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptSegment = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            sessionFinalTranscript += transcriptSegment;
          } else {
            interimTranscript += transcriptSegment;
          }
        }
        
        // Combine initial prompt + all final segments from this session + current interim
        setPrompt(initialPrompt + sessionFinalTranscript + interimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };

      try {
        recognition.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Could not start speech recognition:", err);
        setIsRecording(false);
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setAttachedImage(e.target?.result as string);
          setIsAttachmentMenuOpen(false);
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          setPrompt(prev => prev + (prev ? '\n\n' : '') + `[File: ${file.name}]\n${text}`);
          setIsAttachmentMenuOpen(false);
        };
        reader.readAsText(file);
      }
    }
    // reset inputs
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden font-sans">
      <div 
        className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 select-none"
      >
        <Leaf className="w-6 h-6 text-emerald-500" />
        <span className="text-white font-bold tracking-widest text-lg" style={{ fontFamily: 'Arial' }}>AI LEAF</span>
      </div>

      <div 
        className="absolute top-6 left-6 z-20 text-white/50 hover:text-white transition-colors cursor-pointer"
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
      >
        <Settings className={`w-8 h-8 transition-transform duration-300 ${isSettingsOpen ? 'rotate-90' : ''}`} />
      </div>

      {!isSettingsOpen && (
        <div className="absolute top-8 left-[3.5rem] z-10 pointer-events-none flex items-start text-cyan-400 drop-shadow-md" style={{ animation: 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
          <svg width="60" height="60" viewBox="0 0 100 100" className="mr-2 overflow-visible" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.6))' }}>
            <path d="M 90,70 Q 40,80 20,20" />
            <path d="M 40,22 L 20,20 L 22,40" />
            <circle cx="90" cy="70" r="3" fill="currentColor" stroke="none" />
          </svg>
          <span className="text-sm font-semibold tracking-wide italic whitespace-nowrap mt-8" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
            Add your API key here
          </span>
        </div>
      )}
      
      <button 
        className="absolute top-6 right-6 z-20 flex items-center gap-2 bg-slate-800/60 hover:bg-slate-700/80 backdrop-blur-md border border-slate-700/50 text-slate-300 hover:text-white px-4 py-2 rounded-full transition-all cursor-pointer group shadow-lg"
        onClick={() => setIsSidebarOpen(true)}
      >
        <Clock className="w-5 h-5 group-hover:-rotate-9 transition-transform" />
        <span className="text-sm font-medium">History</span>
      </button>

      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 z-30 backdrop-blur-sm"
              onClick={() => setIsSettingsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute top-16 left-6 z-40 bg-slate-800 border border-slate-700 p-4 rounded-2xl shadow-2xl w-64"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-medium text-sm tracking-wide">Select AI Model</h3>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {(Object.keys(AI_MODELS) as ModelName[]).map(model => (
                  <button
                    key={model}
                    onClick={() => handleModelSelect(model)}
                    className={`relative w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                      selectedModel === model 
                        ? 'text-blue-400' 
                        : 'text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    {selectedModel === model && (
                      <motion.div
                        layoutId="modelIndicator"
                        className="absolute inset-0 bg-blue-500/20 border border-blue-500/30 rounded-xl"
                        initial={false}
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className="relative z-10 font-medium">{model}</span>
                    {selectedModel === model && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", bounce: 0.3, delay: 0.1 }}
                        className="relative z-10"
                      >
                        <Check className="w-4 h-4" />
                      </motion.div>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-5 pt-5 border-t border-slate-700">
                <label className="text-white font-medium text-sm tracking-wide mb-3 block">
                  Model Version
                </label>
                <div className="relative">
                  <select
                    value={selectedVersion}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                  >
                    {AI_MODELS[selectedModel].map(version => (
                      <option key={version} value={version}>
                        {version}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="mt-5 pt-5 border-t border-slate-700">
                <label className="text-white font-medium text-sm tracking-wide mb-3 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  {selectedModel} API Key
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKeys[selectedModel] || ''}
                    onChange={(e) => setApiKeys(prev => ({...prev, [selectedModel]: e.target.value}))}
                    placeholder={`Enter ${selectedModel} key...`}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-28 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-1.5 text-xs flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-md transition-colors font-medium border border-slate-700/50"
                  >
                    {showKey ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        Hide Key
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        Reveal Key
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  Keys are securely stored locally in your browser and never sent to our servers.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 z-30 backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute top-0 right-0 z-40 bg-slate-800 border-l border-slate-700 h-full w-80 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <h2 className="text-white font-medium flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  Chat History
                </h2>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <button 
                  onClick={startNewChat}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg transition-colors font-medium text-sm"
                >
                  <Plus className="w-4 h-4" />
                  New Chat
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 pt-0 flex flex-col gap-2">
                {history.length === 0 && (
                  <p className="text-slate-500 text-sm text-center mt-10">No previous conversations.</p>
                )}
                {history.map(session => (
                  <button
                    key={session.id}
                    onClick={() => loadSession(session)}
                    className={`flex items-start text-left gap-3 p-3 rounded-xl transition-all ${
                      currentSessionId === session.id 
                        ? 'bg-slate-700 border-slate-600' 
                        : 'hover:bg-slate-700/50 border-transparent'
                    } border`}
                  >
                    <MessageSquare className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-slate-200 font-medium text-sm truncate w-full">
                        {session.title}
                      </span>
                      <span className="text-slate-500 text-xs mt-1">
                        {new Date(session.date).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="absolute top-20 bottom-[20%] left-1/2 -translate-x-1/2 w-full max-w-2xl flex flex-col overflow-y-auto pt-6 px-4 pb-4">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex w-full mb-6 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-slate-700'}`}>
                  {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                </div>
                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-3 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none'}`}>
                    {msg.imageUrl && (
                      <img src={msg.imageUrl} alt="Attached" className="max-w-sm rounded-xl mb-3 object-contain max-h-64" />
                    )}
                    {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                  </div>
                  {msg.modelInfo && (
                    <span className="text-[10px] text-slate-500 mt-1 font-medium px-1">
                      {msg.modelInfo}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          {isSubmitting && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex w-full mb-6 justify-start"
            >
              <div className="flex gap-3 max-w-[85%] flex-row">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 bg-slate-700">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col items-start">
                  <div className="px-4 py-3 rounded-2xl shadow-sm bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none flex items-center h-11 gap-1.5">
                    <motion.span 
                      animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: 0 }}
                      className="w-1.5 h-1.5 bg-slate-400 rounded-full inline-block" 
                    />
                    <motion.span 
                      animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                      className="w-1.5 h-1.5 bg-slate-400 rounded-full inline-block" 
                    />
                    <motion.span 
                      animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                      className="w-1.5 h-1.5 bg-slate-400 rounded-full inline-block" 
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <motion.div
        initial={{ 
          opacity: 0, 
          top: '50%', 
          left: '50%', 
          x: '-50%', 
          y: '-50%',
          width: '16rem',
          height: '6rem'
        }}
        animate={{
          opacity: [0, 1, 1, 1, 1],
          top: ['50%', '50%', '50%', '85%', '85%'],
          width: ['16rem', '16rem', '16rem', '6.5rem', '32rem'],
          height: ['6rem', '6rem', '6rem', '2.5rem', '2.5rem'],
        }}
        transition={{
          duration: 4.5,
          times: [0, 0.15, 0.4, 0.7, 1],
          ease: "easeInOut",
        }}
        onAnimationComplete={() => setIsPillAnimDone(true)}
        className="absolute bg-white rounded-full shadow-2xl flex items-center justify-between z-20"
      >
        <AnimatePresence>
          {isPillAnimDone && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full flex items-center pl-3 pr-1.5 gap-2"
            >
              <div className="relative flex-shrink-0" ref={attachmentMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <AnimatePresence>
                  {isAttachmentMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full left-0 mb-3 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-30"
                      >
                        <button 
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left" 
                          onClick={() => {
                            imageInputRef.current?.click();
                          }}
                        >
                          <ImageIcon className="w-4 h-4" />
                          Image
                        </button>
                        <button 
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left border-t border-slate-700/50" 
                          onClick={() => {
                            fileInputRef.current?.click();
                          }}
                        >
                          <File className="w-4 h-4" />
                          Files
                        </button>
                        <button 
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left border-t border-slate-700/50" 
                          onClick={() => {
                            setIsCameraOpen(true);
                            setIsAttachmentMenuOpen(false);
                          }}
                        >
                          <Camera className="w-4 h-4" />
                          Camera
                        </button>
                      </motion.div>
                  )}
                </AnimatePresence>

                <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={handleImageSelect} />
                <input type="file" accept="image/*" ref={imageInputRef} className="hidden" onChange={handleImageSelect} />
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleImageSelect} />
              </div>

              {attachedImage && (
                <div className="absolute bottom-[110%] left-0 z-30 h-16 w-16 min-w-16 rounded-xl overflow-hidden border-2 border-white shadow-xl bg-slate-100 flex items-center justify-center">
                  <img src={attachedImage} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setAttachedImage(null)}
                    className="absolute top-1 right-1 bg-slate-900/60 p-0.5 rounded-full text-white hover:bg-slate-900/80 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <input
                type="text"
                placeholder={isRecording ? "Listening..." : `Ask ${selectedModel}...`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSend();
                  }
                }}
                disabled={isSubmitting}
                className="w-full bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 text-sm font-medium focus:ring-0 disabled:opacity-50"
              />
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <motion.button
                  onClick={toggleRecording}
                  disabled={isSubmitting}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                    delay: 0.05
                  }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    isRecording 
                      ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {isRecording ? <Hexagon className="w-3.5 h-3.5 fill-current" /> : <Mic className="w-3.5 h-3.5" />}
                </motion.button>
                <motion.button
                  onClick={handleSend}
                  disabled={isSubmitting || (!prompt.trim() && !attachedImage)}
                  initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                    delay: 0.1
                  }}
                  className="w-7 h-7 bg-slate-900 rounded-full flex items-center justify-center text-white hover:bg-slate-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5 ml-0.5" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {isCameraOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-4"
          >
            <div className="relative w-full max-w-2xl bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
              <div className="flex justify-between items-center p-4 border-b border-slate-800">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <Camera className="w-5 h-5 text-blue-400" />
                  Take a Photo
                </h3>
                <button 
                  onClick={() => setIsCameraOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                {cameraError ? (
                  <div className="text-center p-6 flex flex-col items-center justify-center h-full">
                    <p className="text-red-400 mb-6 max-w-md">
                      {cameraError === "Permission denied" || cameraError.includes("denied") || cameraError.includes("NotAllowed") 
                        ? "Camera access was denied. Please allow camera permissions in your browser or use your device's native camera." 
                        : `Error: ${cameraError}`}
                    </p>
                    <button 
                      onClick={() => {
                        setIsCameraOpen(false);
                        cameraInputRef.current?.click();
                      }}
                      className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium"
                    >
                      Use Native Camera App
                    </button>
                  </div>
                ) : (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              {!cameraError && (
                <div className="p-6 flex justify-center bg-slate-900">
                  <button
                    onClick={capturePhoto}
                    className="w-16 h-16 rounded-full border-4 border-slate-400 flex items-center justify-center hover:border-slate-300 transition-colors group cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-white rounded-full scale-90 group-hover:scale-100 transition-transform" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
