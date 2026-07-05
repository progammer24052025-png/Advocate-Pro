// Check if browser supports speech recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
    alert('તમારો બ્રાઉઝર સ્પીચ રેકોગ્નિશનને સપોર્ટ કરતો નથી. કૃપા કરીને Chrome, Edge, અથવા Safari નવીનતમ સંસ્કરણ વાપરો.');
}

let recognition = null;
let isRecording = false;
let lastResultIndex = 0;
let accumulatedText = '';

// DOM elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const exportWordBtn = document.getElementById('exportWordBtn');
const textOutput = document.getElementById('textOutput');
const status = document.getElementById('status');
const statusText = document.getElementById('statusText');

// Initialize speech recognition
function initSpeechRecognition() {
    if (!SpeechRecognition) {
        return;
    }

    recognition = new SpeechRecognition();
    
    // Set language to Gujarati (India)
    recognition.lang = 'gu-IN';
    
    // Continuous recognition
    recognition.continuous = true;
    
    // Interim results
    recognition.interimResults = true;
    
    // Maximum alternatives
    recognition.maxAlternatives = 1;

    // Event handlers
    recognition.onstart = () => {
        isRecording = true;
        lastResultIndex = 0;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        status.classList.add('recording');
        statusText.textContent = '🎙️ રેકોર્ડિંગ ચાલુ છે... બોલો!';
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        // Only process new results to avoid duplicates
        for (let i = Math.max(event.resultIndex, lastResultIndex); i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
                // Update lastResultIndex only for final results
                lastResultIndex = i + 1;
            } else {
                interimTranscript += transcript;
            }
        }

        // Only update if we have new final text
        if (finalTranscript.trim()) {
            accumulatedText += finalTranscript;
        }

        // Update text output - show accumulated text + interim
        const displayText = accumulatedText.trim();
        if (displayText) {
            textOutput.innerHTML = '<p>' + displayText + '</p>' + (interimTranscript ? '<p style="opacity: 0.6; font-style: italic;">' + interimTranscript + '</p>' : '');
        } else if (interimTranscript) {
            textOutput.innerHTML = '<p style="opacity: 0.6; font-style: italic;">' + interimTranscript + '</p>';
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        
        let errorMessage = 'ભૂલ: ';
        switch(event.error) {
            case 'no-speech':
                errorMessage += 'કોઈ ભાષણ શોધાયું નથી. કૃપા કરીને ફરી પ્રયાસ કરો.';
                break;
            case 'audio-capture':
                errorMessage += 'માઇક્રોફોન મળ્યું નથી. કૃપા કરીને માઇક્રોફોનને કનેક્ટ કરો.';
                break;
            case 'not-allowed':
                errorMessage += 'માઇક્રોફોનની પરવાનગી આપવામાં આવી નથી. કૃપા કરીને બ્રાઉઝર સેટિંગ્સમાં જઈને પરવાનગી આપો.';
                break;
            case 'network':
                errorMessage += 'નેટવર્ક ભૂલ. કૃપા કરીને ઇન્ટરનેટ કનેક્શન તપાસો.';
                break;
            default:
                errorMessage += event.error;
        }
        
        status.classList.remove('recording');
        status.classList.add('error');
        statusText.textContent = errorMessage;
        
        setTimeout(() => {
            status.classList.remove('error');
            if (!isRecording) {
                statusText.textContent = 'તૈયાર છે - "વૉઇસ રેકોર્ડિંગ શરૂ કરો" બટન પર ક્લિક કરો';
            }
        }, 5000);
    };

    recognition.onend = () => {
        if (isRecording) {
            // Reset result index when restarting to avoid processing old results
            lastResultIndex = 0;
            // Automatically restart if still recording
            try {
                recognition.start();
            } catch (e) {
                console.error('Error restarting recognition:', e);
                stopRecording();
            }
        } else {
            status.classList.remove('recording');
            statusText.textContent = 'રેકોર્ડિંગ બંધ થયું.';
        }
    };
}

// Start recording
function startRecording() {
    if (!recognition) {
        initSpeechRecognition();
    }
    
    if (recognition && !isRecording) {
        // Reset accumulated text and result index
        accumulatedText = textOutput.textContent.replace(/તમારું લખાણ અહીં દેખાશે\.\.\./g, '').trim();
        if (accumulatedText) {
            accumulatedText += ' ';
        }
        lastResultIndex = 0;
        
        try {
            recognition.start();
        } catch (e) {
            console.error('Error starting recognition:', e);
            status.classList.add('error');
            statusText.textContent = 'રેકોર્ડિંગ શરૂ કરવામાં ભૂલ. કૃપા કરીને પૃષ્ઠને રિફ્રેશ કરો.';
        }
    }
}

// Stop recording
function stopRecording() {
    if (recognition && isRecording) {
        isRecording = false;
        recognition.stop();
        startBtn.disabled = false;
        stopBtn.disabled = true;
        status.classList.remove('recording');
        statusText.textContent = 'રેકોર્ડિંગ બંધ થયું.';
    }
}

// Clear text
function clearText() {
    accumulatedText = '';
    lastResultIndex = 0;
    textOutput.innerHTML = '<p class="placeholder">તમારું લખાણ અહીં દેખાશે...</p>';
    statusText.textContent = 'લખાણ સાફ કર્યું.';
    setTimeout(() => {
        statusText.textContent = 'તૈયાર છે - "વૉઇસ રેકોર્ડિંગ શરૂ કરો" બટન પર ક્લિક કરો';
    }, 2000);
}

// Copy text to clipboard
async function copyText() {
    const text = textOutput.textContent.replace(/તમારું લખાણ અહીં દેખાશે\.\.\./g, '').trim();
    
    if (!text) {
        statusText.textContent = 'કૉપી કરવા માટે કોઈ લખાણ નથી.';
        setTimeout(() => {
            statusText.textContent = 'તૈયાર છે - "વૉઇસ રેકોર્ડિંગ શરૂ કરો" બટન પર ક્લિક કરો';
        }, 2000);
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✓ કૉપી થયું!';
        copyBtn.style.background = '#28a745';
        
        statusText.textContent = 'લખાણ ક્લિપબોર્ડમાં કૉપી થયું!';
        
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = '#28a745';
            statusText.textContent = 'તૈયાર છે - "વૉઇસ રેકોર્ડિંગ શરૂ કરો" બટન પર ક્લિક કરો';
        }, 2000);
    } catch (err) {
        console.error('Failed to copy text:', err);
        statusText.textContent = 'કૉપી કરવામાં ભૂલ. કૃપા કરીને મેન્યુઅલી કૉપી કરો.';
    }
}

// Export to Word document
function exportToWord() {
    const text = textOutput.textContent.replace(/તમારું લખાણ અહીં દેખાશે\.\.\./g, '').trim();
    
    if (!text) {
        statusText.textContent = 'Word ફાઇલ બનાવવા માટે કોઈ લખાણ નથી.';
        setTimeout(() => {
            statusText.textContent = 'તૈયાર છે - "વૉઇસ રેકોર્ડિંગ શરૂ કરો" બટન પર ક્લિક કરો';
        }, 2000);
        return;
    }

    try {
        statusText.textContent = 'Word ફાઇલ બનાવી રહ્યા છીએ...';
        exportWordBtn.disabled = true;

        // Create Word-compatible HTML document
        // This creates a .doc file that Microsoft Word can open
        const htmlContent = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
    <meta charset='utf-8'>
    <meta name='ProgId' content='Word.Document'>
    <meta name='Generator' content='Gujarati Voice to Text Converter'>
    <meta name='Originator' content='Gujarati Voice to Text Converter'>
    <title>Gujarati Text Document</title>
    <!--[if gte mso 9]>
    <xml>
        <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>90</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
            <w:ValidateAgainstSchemas/>
            <w:SaveIfXMLInvalid>false</w:SaveIfXMLInvalid>
            <w:IgnoreMixedContent>false</w:IgnoreMixedContent>
            <w:AlwaysShowPlaceholderText>false</w:AlwaysShowPlaceholderText>
            <w:Compatibility>
                <w:BreakWrappedTables/>
                <w:SnapToGridInCell/>
                <w:WrapTextWithPunct/>
                <w:UseAsianBreakRules/>
            </w:Compatibility>
        </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
        @page {
            size: 8.5in 11in;
            margin: 1in 1.25in 1in 1.25in;
            mso-header-margin: .5in;
            mso-footer-margin: .5in;
        }
        body {
            font-family: 'Lohit Gujarati', 'Noto Sans Gujarati', sans-serif;
            font-size: 12pt;
            line-height: 1.6;
            direction: ltr;
            text-align: left;
        }
        h1 {
            text-align: center;
            font-size: 18pt;
            font-weight: bold;
            margin-bottom: 20pt;
            font-family: 'Lohit Gujarati', 'Noto Sans Gujarati', sans-serif;
        }
        .content {
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: 'Lohit Gujarati', 'Noto Sans Gujarati', sans-serif;
            font-size: 12pt;
        }
        p {
            margin: 0 0 12pt 0;
        }
    </style>
</head>
<body>
    <h1>ગુજરાતી ટેક્સ્ટ ડોક્યુમેન્ટ</h1>
    <div class="content">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
    <p style="margin-top: 20pt; font-size: 10pt; color: #666; text-align: center;">
        <em>આ ડોક્યુમેન્ટ ગુજરાતી વૉઇસ ટુ ટેક્સ્ટ કન્વર્ટર દ્વારા બનાવવામાં આવ્યું છે</em><br>
        <em>તારીખ: ${new Date().toLocaleDateString('gu-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</em>
    </p>
</body>
</html>`;

        // Create blob with BOM for proper UTF-8 encoding
        const blob = new Blob(['\ufeff', htmlContent], { 
            type: 'application/msword' 
        });
        
        const fileName = `Gujarati_Text_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}_${Date.now()}.doc`;
        
        // Download the file
        if (typeof saveAs !== 'undefined') {
            saveAs(blob, fileName);
        } else {
            // Fallback download method
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }

        statusText.textContent = 'Word ફાઇલ સફળતાપૂર્વક ડાઉનલોડ થઈ!';
        exportWordBtn.disabled = false;

        setTimeout(() => {
            statusText.textContent = 'તૈયાર છે - "વૉઇસ રેકોર્ડિંગ શરૂ કરો" બટન પર ક્લિક કરો';
        }, 3000);
    } catch (err) {
        console.error('Failed to export Word document:', err);
        statusText.textContent = 'Word ફાઇલ બનાવવામાં ભૂલ. કૃપા કરીને ફરી પ્રયાસ કરો.';
        exportWordBtn.disabled = false;
        
        setTimeout(() => {
            statusText.textContent = 'તૈયાર છે - "વૉઇસ રેકોર્ડિંગ શરૂ કરો" બટન પર ક્લિક કરો';
        }, 3000);
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event listeners
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);
clearBtn.addEventListener('click', clearText);
copyBtn.addEventListener('click', copyText);
exportWordBtn.addEventListener('click', exportToWord);

// Initialize on page load
if (SpeechRecognition) {
    initSpeechRecognition();
}

// Handle text output editing
textOutput.addEventListener('input', () => {
    // Remove placeholder when user types
    const placeholder = textOutput.querySelector('.placeholder');
    if (placeholder && textOutput.textContent.trim() !== 'તમારું લખાણ અહીં દેખાશે...') {
        placeholder.remove();
    }
    // Sync accumulated text with user edits
    accumulatedText = textOutput.textContent.replace(/તમારું લખાણ અહીં દેખાશે\.\.\./g, '').trim();
    if (accumulatedText) {
        accumulatedText += ' ';
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to start/stop
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }
    
    // Ctrl/Cmd + C to copy (when not in text area)
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && e.target !== textOutput) {
        copyText();
    }
});

