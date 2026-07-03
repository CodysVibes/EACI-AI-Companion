var notesState = {
  active: false,
  fullTranscript: '',
  timer: null,
  restartTime: 15000,
  socket: null,
  stream: null
};

async function toggleNotesMode() {
  var btn = document.getElementById('notesBtn');
  if (!notesState.active) {
    // Start Notes Mode
    notesState.active = true;
    notesState.fullTranscript = '';
    btn.innerText = 'Listening...';
    btn.style.background = '#ff6b6b';
    btn.style.color = '#fff';
    
    addMessage('system', 'Notes Mode activated. Just speak, and I will document everything.');
    _startNotesRecording();
  } else {
    // Stop Notes Mode
    notesState.active = false;
    btn.innerText = 'Notes';
    btn.style.background = 'rgba(167,139,250,.15)';
    btn.style.color = '#a78bfa';
    
    if (notesState.timer) clearTimeout(notesState.timer);
    _stopNotesRecording();
    
    addMessage('system', 'Generating nicely formatted note file...');
    await _finalizeNotes();
  }
}

function _sendToActiveCompanion(text) {
  // If we're in live mode, the live chat system handles its own input.
  // This is for the standard chat interface.
  const companion = state.activeTab === 'caelum' ? 'caelum' : 'chad';
  
  // Add user message to UI
  addMessage('user', text);
  
  // Push to history
  if (state.conversationHistory) {
      state.conversationHistory.push({ 
        role: 'user', 
        content: `[${companion === 'caelum' ? 'Caelum' : 'Chad'}] ${text}` 
      });
  }

  // Trigger response
  if (typeof sendMessage === 'function') {
      sendMessage(text);
  }
}

async function _startNotesRecording() {
  if (!notesState.active) return;
  
  // We'll use the existing Deepgram STT infrastructure
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    notesState.stream = stream;
    
    // Request a token and start transcription
    const authHeaders = await getAuthHeaders();
    const tokenResp = await fetch(CONFIG.sttTokenEndpoint, { headers: authHeaders });
    const { token } = await tokenResp.json();
    
    const socket = new WebSocket('wss://api.deepgram.com/v1/listen', ['token', token]);
    notesState.socket = socket;
    
    socket.onopen = () => {
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorder.addEventListener('dataavailable', event => {
        if (event.data.size > 0 && socket.readyState === 1) socket.send(event.data);
      });
      mediaRecorder.start(250);
    };

    socket.onmessage = message => {
      const received = JSON.parse(message.data);
      const transcript = received.channel.alternatives[0].transcript;
      if (transcript && received.is_final) {
        notesState.fullTranscript += ' ' + transcript;
      }
    };

    // Every 15 seconds, we "pulse" to keep things alive if needed, 
    // but the stream stays open generally.
    notesState.timer = setTimeout(() => {
        if(notesState.active) {
            console.log("Notes check-in: Keeping connection alive.");
            // Re-trigger if socket dies, but usually Deepgram handles long streams
        }
    }, notesState.restartTime);

  } catch (err) {
    console.error('Notes Mode Error:', err);
    toggleNotesMode();
  }
}

function _stopNotesRecording() {
  if (notesState.socket) notesState.socket.close();
  if (notesState.stream) notesState.stream.getTracks().forEach(t => t.stop());
}

async function _finalizeNotes() {
    if (!notesState.fullTranscript.trim()) {
        addMessage('system', 'No notes captured.');
        return;
    }

    // Ask AI to format it nicely
    try {
        const prompt = `You are a helpful assistant. I will provide a long transcript of a voice note. 
        Please format this into a professional text document.
        Include:
        1. A catchy Title at the top.
        2. A "Key Takeaways" bulleted section.
        3. Organized sections with headings for different topics discussed.
        4. A "Detailed Summary" at the end.
        
        Transcript: ${notesState.fullTranscript}`;

        const authHeaders = await getAuthHeaders();
        const resp = await fetch(CONFIG.chatEndpoint, {
            method: 'POST',
            headers: Object.assign({'Content-Type': 'application/json; charset=utf-8'}, authHeaders),
            body: JSON.stringify({
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.7
            })
        });

        const data = await resp.json();
        const formattedNote = data.choices[0].message.content;

        // Create a text file in the database/files list
        const fileName = "Note_" + new Date().toISOString().slice(0,10) + "_" + Math.floor(Math.random()*1000) + ".txt";
        
        // Use existing saveFile logic if available, or direct Supabase call
        const { error } = await supabase.from('user_files').insert({
            user_id: state.user.id,
            name: fileName,
            content: formattedNote,
            type: 'text/plain',
            size: formattedNote.length
        });

        if (error) throw error;

        addMessage('caelum', `I've documented everything! I've organized your points and saved it as **${fileName}** in your Files tab.`);
        if (typeof renderFiles === 'function') renderFiles();

        // Also send the raw transcript to the companion so they can talk about it
        _sendToActiveCompanion("I just finished recording a note. Here is the transcript: " + notesState.fullTranscript);

    } catch (err) {
        console.error('Finalize Notes Error:', err);
        addMessage('system', 'Could not save the notes to your files, but here is the transcript: ' + notesState.fullTranscript);
    }
}
