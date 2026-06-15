// ─────────────────────────────────────────────────────────────────────────────
// tools/ai-assistant.js — Antigravity PDF Pro
// AI PDF Assistant — Phase 3 Implementation
// Features: Chat with PDF, Auto-Summarization, Offline Fallback & API Modes
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const aiInput = document.getElementById('aiInput');
    const aiUploadState = document.getElementById('ai-upload-state');
    const aiChatState = document.getElementById('ai-chat-state');
    const aiDocName = document.getElementById('aiDocName');
    const aiDocMeta = document.getElementById('aiDocMeta');
    const btnAiReset = document.getElementById('btnAiReset');
    const btnAiSummarize = document.getElementById('btnAiSummarize');
    const aiSummaryText = document.getElementById('aiSummaryText');
    const aiChatHistory = document.getElementById('aiChatHistory');
    const aiChatForm = document.getElementById('aiChatForm');
    const aiChatInput = document.getElementById('aiChatInput');
    const aiEngineLabel = document.getElementById('aiEngineLabel');

    if (!aiInput || !aiUploadState || !aiChatState) return;

    let currentFile = null;
    let extractedText = '';
    let pageTexts = []; // Array of text per page

    // ─── File Upload Handler ──────────────────────────────────────────────────
    aiInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            window.AGToast.error('Please select a valid PDF file.');
            return;
        }

        currentFile = file;
        window.AGProgress.start('Uploading PDF...', 'Reading document structure');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            // Load meta details
            aiDocName.textContent = file.name;
            const sizeMB = (file.size / 1024 / 1024).toFixed(2);
            aiDocMeta.textContent = `${sizeMB} MB • ${pdf.numPages} pages`;

            // Extract text
            pageTexts = [];
            extractedText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                window.AGProgress.set(Math.round((i / pdf.numPages) * 90), 'Extracting text', `Page ${i} of ${pdf.numPages}`);
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const text = textContent.items.map(item => item.str).join(' ');
                pageTexts.push(text);
                extractedText += `\n--- Page ${i} ---\n` + text;
            }

            // Sync engine label based on settings
            await updateEngineLabel();

            // Transition UI
            aiUploadState.classList.add('d-none');
            aiChatState.classList.remove('d-none');
            resetChatHistory();

            window.AGProgress.done();
            window.AGToast.success('PDF successfully analyzed!');
        } catch (err) {
            console.error('AI PDF analysis failed', err);
            window.AGProgress.error();
            window.AGToast.error('Failed to read PDF file.');
        }
    });

    // ─── Reset Handler ────────────────────────────────────────────────────────
    btnAiReset.addEventListener('click', () => {
        currentFile = null;
        extractedText = '';
        pageTexts = [];
        aiInput.value = '';
        aiUploadState.classList.remove('d-none');
        aiChatState.classList.add('d-none');
        aiSummaryText.textContent = 'সামারি দেখতে উপরের "Auto Summarize" বাটনে ক্লিক করুন।';
        resetChatHistory();
    });

    // ─── Reset Chat History ───────────────────────────────────────────────────
    function resetChatHistory() {
        aiChatHistory.innerHTML = `
            <div class="ai-chat-message assistant">
                হ্যালো! পিডিএফ ফাইলটি সফলভাবে আপলোড করা হয়েছে। আপনি এই ফাইলের যেকোনো তথ্য নিয়ে আমাকে প্রশ্ন করতে পারেন, অথবা বাম প্যানেলের "Auto Summarize" বাটনে ক্লিক করে এর মূল সারসংক্ষেপ জেনে নিতে পারেন।
            </div>
        `;
    }

    // ─── Update Engine Label ──────────────────────────────────────────────────
    async function updateEngineLabel(overrideSettings) {
        if (!aiEngineLabel) return;
        // Use override (from event detail) or fresh get()
        const settings = overrideSettings || await window.AGSettings.get();
        if (settings.aiProvider === 'offline' || !settings.aiApiKey) {
            aiEngineLabel.textContent = 'Mode: Offline (Simulation)';
        } else {
            const providerName = settings.aiProvider === 'gemini' ? 'Gemini' : 'OpenAI';
            aiEngineLabel.textContent = `Mode: ${providerName} (${settings.aiModel})`;
        }
    }

    // ─── React to settings saved (API key / provider changes) ────────────────
    window.addEventListener('agSettingsSaved', (e) => {
        // e.detail already has the freshly-saved settings
        updateEngineLabel(e.detail);
    });

    // Show correct label immediately (before any file is uploaded)
    updateEngineLabel();

    // ─── Auto Summarize Click Handler ──────────────────────────────────────────
    btnAiSummarize.addEventListener('click', async () => {
        if (!currentFile) return;

        btnAiSummarize.disabled = true;
        btnAiSummarize.textContent = '⌛ Summarizing...';
        aiSummaryText.textContent = 'সারাংশ তৈরি করা হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...';

        try {
            const settings = await window.AGSettings.get();
            const provider = settings.aiProvider || 'offline';
            const apiKey = settings.aiApiKey || '';

            if (provider === 'offline' || !apiKey) {
                // Generate simulated premium offline summary
                setTimeout(() => {
                    const keywords = extractKeywords(extractedText);
                    const docNameClean = currentFile.name.replace(/\.[^/.]+$/, "");
                    
                    const summary = `📄 **Document Name:** ${docNameClean}
                    
🔍 **বিশ্লেষণ ও বিষয়বস্তু:**
এই পিডিএফ ফাইলটি মূলত "${docNameClean}" সম্পর্কিত গুরুত্বপূর্ণ তথ্য এবং আলোচনার বিবরণ ধারণ করে। টেক্সট এনালাইসিস অনুযায়ী এখানে নিম্নলিখিত কি-ওয়ার্ড ও প্রধান বিষয়গুলোর ওপর আলোকপাত করা হয়েছে।

💡 **প্রধান বিষয়সমূহ (Key Terms Found):**
${keywords.map(kw => `• **${kw}**: ডকুমেন্টের বিভিন্ন অংশে এই বিষয়টি আলোচনা করা হয়েছে।`).join('\n')}

📈 **সারসংক্ষেপ:**
ডকুমেণ্টটিতে টেক্সট স্ট্রাকচার অনুযায়ী সূচনা অংশ, মূল বিষয়বস্তু এবং শেষাংশে প্রয়োজনীয় সুপারিশ বা সিদ্ধান্ত রয়েছে। এটি একটি গুরুত্বপূর্ণ অফলাইন রিপোর্ট বা ডেটাশীট হিসেবে ব্যবহারযোগ্য।

> ℹ️ *দ্রষ্টব্য: জেমিনি বা ওপেনএআই-এর মাধ্যমে গভীর বিশ্লেষণ পেতে Settings গিয়ার আইকন থেকে আপনার API Key যুক্ত করুন।*`;
                    
                    aiSummaryText.innerHTML = formatMarkdown(summary);
                    btnAiSummarize.disabled = false;
                    btnAiSummarize.textContent = '⚡ Auto Summarize';
                    window.AGToast.success('Offline summary generated!');
                }, 1500);
            } else {
                // Online API Summarization
                const prompt = "Please write a comprehensive, bulleted summary of this document in Bengali. Highlight key points, conclusions, and important terms. Use markdown.";
                const context = getTruncatedContext(3000); // Send first 3000 tokens/characters to fit context window safely
                
                const summary = await callAI(prompt, context, settings);
                aiSummaryText.innerHTML = formatMarkdown(summary);
                btnAiSummarize.disabled = false;
                btnAiSummarize.textContent = '⚡ Auto Summarize';
                window.AGToast.success('AI Summary generated!');
            }
        } catch (error) {
            console.error('Summarization failed', error);
            const errMsg = error?.message || 'Unknown error';
            aiSummaryText.textContent = `❌ সারাংশ তৈরি করা সম্ভব হয়নি।\n\nError: ${errMsg}\n\nদয়া করে চেক করুন:\n• API Key সঠিক আছে কিনা\n• ইন্টারনেট সংযোগ আছে কিনা\n• Gemini Free Quota শেষ হয়নি কিনা`;
            btnAiSummarize.disabled = false;
            btnAiSummarize.textContent = '⚡ Auto Summarize';
            window.AGToast.error(`AI Error: ${errMsg.substring(0, 80)}`);
        }
    });

    // ─── Chat Message Submit Handler ──────────────────────────────────────────
    aiChatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const question = aiChatInput.value.trim();
        if (!question) return;

        // Clear input & append user message
        aiChatInput.value = '';
        appendMessage('user', question);
        scrollChat();

        // Show typing indicator
        const typingIndicator = showTypingIndicator();

        try {
            const settings = await window.AGSettings.get();
            const provider = settings.aiProvider || 'offline';
            const apiKey = settings.aiApiKey || '';

            if (provider === 'offline' || !apiKey) {
                // Simulated Offline Q&A
                setTimeout(() => {
                    removeTypingIndicator(typingIndicator);
                    const answer = searchOfflineContext(question);
                    appendMessage('assistant', answer);
                    scrollChat();
                }, 1200);
            } else {
                // Live AI Q&A
                const relevantContext = findRelevantPages(question, 3); // Get up to 3 most relevant pages
                const systemPrompt = `You are a helpful PDF Assistant. Answer the user's question based strictly on the provided PDF context. If you cannot find the answer, explain that you don't know based on the document but answer generally if helpful. Answer in Bengali.
                
Context from PDF:
${relevantContext}`;

                const response = await callAI(question, systemPrompt, settings);
                removeTypingIndicator(typingIndicator);
                appendMessage('assistant', response);
                scrollChat();
            }
        } catch (error) {
            console.error('AI Q&A failed', error);
            const errMsg = error?.message || 'Unknown error';
            removeTypingIndicator(typingIndicator);
            appendMessage('error', `❌ **AI Error:** ${errMsg}\n\nদয়া করে চেক করুন: API Key, ইন্টারনেট সংযোগ, এবং Gemini quota।`);
            scrollChat();
        }
    });

    // ─── Append Message to Chat ───────────────────────────────────────────────
    function appendMessage(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `ai-chat-message ${sender}`;
        msgDiv.innerHTML = formatMarkdown(text);
        aiChatHistory.appendChild(msgDiv);
    }

    // ─── Typing Indicator helpers ─────────────────────────────────────────────
    function showTypingIndicator() {
        const ind = document.createElement('div');
        ind.className = 'ai-typing-indicator';
        ind.innerHTML = `
            <div class="ai-typing-dot"></div>
            <div class="ai-typing-dot"></div>
            <div class="ai-typing-dot"></div>
        `;
        aiChatHistory.appendChild(ind);
        scrollChat();
        return ind;
    }

    function removeTypingIndicator(indicator) {
        if (indicator && indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }

    function scrollChat() {
        aiChatHistory.scrollTop = aiChatHistory.scrollHeight;
    }

    // ─── AI Call Wrapper ──────────────────────────────────────────────────────
    async function callAI(prompt, context, settings) {
        const provider = settings.aiProvider;
        const apiKey = settings.aiApiKey;
        const model = settings.aiModel;

        if (provider === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: `${context}\n\nUser Question: ${prompt}` }
                            ]
                        }
                    ]
                })
            });
            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.error?.message || `HTTP error ${response.status}`);
            }
            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        } else if (provider === 'openai') {
            const url = `https://api.openai.com/v1/chat/completions`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: context },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7
                })
            });
            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.error?.message || `HTTP error ${response.status}`);
            }
            const data = await response.json();
            return data.choices[0].message.content;
        }
        throw new Error('Unsupported AI provider selected');
    }

    // ─── Simple Markdown Formatter ────────────────────────────────────────────
    function formatMarkdown(text) {
        let clean = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Bold (**text**)
        clean = clean.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // Bullet points
        clean = clean.replace(/^\s*•\s+(.+)$/gm, '<li>$1</li>');
        clean = clean.replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>');
        // Wrap lists
        if (clean.includes('<li>')) {
            clean = clean.replace(/(<li>.*<\/li>)/gs, '<ul style="margin: 6px 0; padding-left: 20px;">$1</ul>');
        }
        // Blockquote (> text)
        clean = clean.replace(/^\s*>\s+(.+)$/gm, '<blockquote style="border-left: 4px solid var(--primary); padding-left: 10px; margin: 8px 0; color: var(--text-muted);">$1</blockquote>');
        // Newlines to <br>
        clean = clean.replace(/\n/g, '<br>');

        return clean;
    }

    // ─── Text analysis helper: Extract Keywords ──────────────────────────────
    function extractKeywords(text) {
        if (!text) return ['General PDF'];
        const words = text.toLowerCase()
            .replace(/[^\w\s\u0980-\u09ff]/g, ' ') // support bengali unicode too
            .split(/\s+/);
        
        const stopWords = new Set([
            'and', 'the', 'is', 'in', 'of', 'to', 'for', 'with', 'on', 'this', 'that', 'our', 'your',
            'এবং', 'ও', 'কিন্তু', 'অথবা', 'হলো', 'করে', 'থেকে', 'হতে', 'জন্য', 'একটি'
        ]);

        const counts = {};
        words.forEach(w => {
            if (w.length > 3 && !stopWords.has(w)) {
                counts[w] = (counts[w] || 0) + 1;
            }
        });

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(entry => entry[0].toUpperCase());
    }

    // ─── Get truncated context safely ─────────────────────────────────────────
    function getTruncatedContext(maxLength) {
        if (extractedText.length <= maxLength) return extractedText;
        return extractedText.substring(0, maxLength) + '\n\n[Content Truncated due to size]';
    }

    // ─── Find relevant pages based on query keywords ─────────────────────────
    function findRelevantPages(query, maxPages = 3) {
        const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        if (queryWords.length === 0) return pageTexts.slice(0, maxPages).join('\n');

        const scoredPages = pageTexts.map((text, idx) => {
            let score = 0;
            const textLower = text.toLowerCase();
            queryWords.forEach(word => {
                if (textLower.includes(word)) score += 1;
            });
            return { index: idx, content: text, score: score };
        });

        // Sort by score and get top pages
        const topPages = scoredPages
            .filter(page => page.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxPages);

        if (topPages.length === 0) {
            // Fallback to first few pages
            return pageTexts.slice(0, maxPages).map((t, idx) => `Page ${idx + 1}:\n${t}`).join('\n');
        }

        return topPages.map(p => `Page ${p.index + 1}:\n${p.content}`).join('\n');
    }

    // ─── Offline Context Search Algorithm ─────────────────────────────────────
    function searchOfflineContext(query) {
        const queryLower = query.toLowerCase();
        
        // Find if there's any matching page with text
        const matchedSentences = [];
        pageTexts.forEach((text, pageIdx) => {
            // Split sentences
            const sentences = text.split(/[.।]/);
            sentences.forEach(sentence => {
                if (sentence.toLowerCase().includes(queryLower)) {
                    matchedSentences.push({ page: pageIdx + 1, sentence: sentence.trim() });
                }
            });
        });

        if (matchedSentences.length > 0) {
            const topMatch = matchedSentences[0];
            return `📄 **Page ${topMatch.page}-এ প্রাপ্ত প্রাসঙ্গিক তথ্য:**
            
"...${topMatch.sentence}..."

💡 *অফলাইন অ্যানালিসিস:* ডকুমেন্টের পেজ নম্বর **${topMatch.page}**-এ আপনার প্রশ্নের সাথে সম্পর্কিত লাইন পাওয়া গিয়েছে। 

> ℹ️ *জাপানি বা জেমিনির মতো উচ্চমানের AI রেজাল্ট ও গভীর আলোচনার জন্য দয়া করে Settings থেকে আপনার Real API Key যুক্ত করুন।*`;
        }

        // General simulated fallback
        const keywords = extractKeywords(extractedText);
        return `🔍 **অফলাইন মোড উত্তর:**
আমি অফলাইনে আপনার প্রশ্নটি বিশ্লেষণ করেছি। আপনার প্রশ্নে উল্লেখিত কি-ওয়ার্ড বা বিষয় সরাসরি পিডিএফ টেক্সটে পাওয়া যায়নি। 

তবে ডকুমেন্টের মূল টার্মগুলো হলো: **${keywords.join(', ')}**। 

দয়া করে সঠিক এআই বিশ্লেষণের জন্য Settings গিয়ার আইকনে ক্লিক করে আপনার **Gemini** বা **OpenAI API Key** যুক্ত করুন, যা দিয়ে এআই ফাইলটি সম্পূর্ণ পড়ে আপনার নিখুঁত উত্তর দিতে পারবে।`;
    }
});
