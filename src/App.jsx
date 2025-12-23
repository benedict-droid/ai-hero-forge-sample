import { useState, useRef, useEffect } from 'react';
import { characters } from './characters';


const DEFAULT_API_KEY = 'enter api key here';

function App() {
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [selectedCharacter, setSelectedCharacter] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [base64Image, setBase64Image] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Initialize with the first character
  useEffect(() => {
    if (characters.length > 0) {
      handleCharacterChange(characters[0].name);
    }
  }, []);

  const getCharacterPrompt = (characterName) => {
    let charMeta = characters.find(c => c.name === characterName);

    if (!charMeta && characters.length > 0) {
      charMeta = characters[0];
    }

    if (!charMeta) return "";

    return `
EDIT MODE (STRICT — IMAGE EDITING ONLY):
Apply changes ONLY to costume, body, pose, props, and background.
DO NOT regenerate, redraw, reinterpret, or structurally modify the face of the user. 
DO NOT add mask or helmet or any thing in face or head.
DO NOT use background details of the original image only use the face of the user.
DO NOT use the face of the character only use the face of the user.
Generate photorealistic image.
REMOVE everything that cover the face or head.
REMOVE mask or helmet or anything in face or head.



IDENTITY LOCK (CRITICAL):
- Preserve exact facial geometry, proportions, and expression.
- Preserve original skin texture and facial details.
- Do NOT change eyes, nose, lips, jawline, facial hair, wrinkles, scars, or blemishes.

FACE LIGHTING RULE (IMPORTANT):
- Match the scene lighting on the face using global color, exposure, and light balancing ONLY.
- Do NOT repaint, reshape, or regenerate facial features.
- Lighting adjustment must not alter facial identity or details.

FACE HANDLING RULES:
- Treat the face region as a protected and non-editable area.
- No costume, helmet, mask, shadow, or object may overlap the face.
- Seamless blending is allowed ONLY at the neck and jawline edge.

EDIT CONSTRAINTS:
- Modify ONLY areas outside the face region.
- If the character normally wears a mask or helmet, keep it OFF.

CHARACTER DETAILS:
Name: ${charMeta.name}
Traits: ${charMeta.traits}
Visual Style: ${charMeta.visual_style}
Edits to Apply: ${charMeta.edit_instructions}

QUALITY REQUIREMENTS:
- Photorealistic output
- Natural and consistent lighting
- High-fidelity identity preservation

FAILURE CONDITIONS:
- If facial identity, structure, or details change, the result is INVALID.
`;

  };

  const handleCharacterChange = (charName) => {
    setSelectedCharacter(charName);
    const newPrompt = getCharacterPrompt(charName);
    setPrompt(newPrompt);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedImage(URL.createObjectURL(file));

    const reader = new FileReader();
    reader.onloadend = () => {
      // Extract base64 part (remove data:image/png;base64, prefix)
      const base64String = reader.result.split(',')[1];
      setBase64Image({
        mime_type: file.type,
        data: base64String
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      // Reuse logic via simulated event or direct call
      // Better to duplicate logic for clarity in this snippet or extract function
      setSelectedImage(URL.createObjectURL(file));
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result.split(',')[1];
        setBase64Image({
          mime_type: file.type,
          data: base64String
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      setCameraStream(stream);
      setShowCamera(true);
      // Wait for state to update and ref to be attached
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the video frame to the canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/png');
      setSelectedImage(dataUrl);

      // Extract base64 for API
      const base64String = dataUrl.split(',')[1];
      setBase64Image({
        mime_type: 'image/png',
        data: base64String
      });

      stopCamera();
    }
  };

  const generateImage = async () => {
    if (!apiKey) {
      setError("Please enter an API Key");
      return;
    }
    if (!base64Image) {
      setError("Please upload an image first");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: base64Image.mime_type,
                  data: base64Image.data
                }
              }
            ]
          }
        ]
      };

      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("API Response:", data);
      setResult(data);

    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to render output based on structure
  const renderOutput = () => {
    if (!result) return null;

    // Handle standard Gemini generateContent response
    // Handle standard and user-custom response structures
    let parts = [];
    if (result.candidates && result.candidates.length > 0) {
      parts = result.candidates[0].content?.parts || [];
    } else if (result.contents && result.contents.length > 0) {
      parts = result.contents[0].parts || [];
    }

    console.log("Rendering output, result:", result);
    console.log("Parts extraction:", parts);

    if (parts.length > 0) {
      return (
        <div className="glass-panel result-container">
          {parts.map((part, index) => {
            if (part.text) {
              return (
                <div key={index} style={{ marginBottom: '1.5rem' }}>
                  <h3>Response</h3>
                  <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{part.text}</p>
                </div>
              );
            }

            // Handle both snake_case (standard REST) and camelCase (SDK/Some Proxies)
            const imgObj = part.inline_data || part.inlineData;

            if (imgObj) {
              const mimeType = imgObj.mime_type || imgObj.mimeType || 'image/png';
              const base64Data = imgObj.data || imgObj.bytes;

              if (!base64Data) {
                console.warn("Image object found but no data:", imgObj);
                return null;
              }

              return (
                <div key={index} style={{ marginBottom: '1.5rem' }}>
                  <h3>Generated Image</h3>
                  <img
                    src={`data:${mimeType};base64,${base64Data}`}
                    alt="Generated"
                    className="result-image"
                  />
                </div>
              );
            }
            return null;
          })}
        </div>
      );
    }

    // Handle possible legacy/other formats (e.g., Vertex AI Imagen style predictions)
    if (result.predictions && result.predictions.length > 0) {
      return (
        <div className="glass-panel result-container">
          <h3>Generated Image</h3>
          {result.predictions.map((pred, index) => (
            <img
              key={index}
              src={`data:image/png;base64,${pred.bytesBase64Encoded || pred}`}
              alt="Generated prediction"
              className="result-image"
              style={{ marginBottom: '1rem' }}
            />
          ))}
        </div>
      );
    }

    // Fallback if structure is thoroughly unrecognized (e.g. error object inside success 200)
    return (
      <div className="glass-panel result-container">
        <h3>Output info</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Response received but format unrecognized.</p>
      </div>
    );
  };

  return (
    <div className="app-container">
      <h1>Gemini <span style={{ color: 'var(--accent-primary)' }}>Vision</span> Test Playground</h1>
      <p className="subtitle">Transform your images with the power of multimodal AI.</p>

      <div className="app-grid">
        {/* Left Column: Controls */}
        <div className="controls-column">
          <div className="glass-panel">
            <div className="input-group">
              <label>API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your Google Cloud API Key"
              />
            </div>

            <div className="input-group">
              <label>Character Preset</label>
              <select
                value={selectedCharacter}
                onChange={(e) => handleCharacterChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                  outline: 'none',
                  marginBottom: '1rem'
                }}
              >
                {characters.map(char => (
                  <option key={char.name} value={char.name} style={{ background: '#1e1e2e' }}>
                    {char.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe how to transform the image..."
                style={{ minHeight: '150px' }}
              />
            </div>

            <div className="input-group">
              <label>Source Image</label>
              {showCamera ? (
                <div className="camera-container" style={{ position: 'relative', marginBottom: '1rem' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{ width: '100%', borderRadius: '8px', background: '#000' }}
                  />
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'center' }}>
                    <button onClick={capturePhoto} className="btn" style={{ background: 'var(--accent-primary)', flex: 1 }}>Capture</button>
                    <button onClick={stopCamera} className="btn" style={{ background: '#ef4444', flex: 1 }}>Cancel</button>
                  </div>
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>
              ) : (
                <div
                  className="file-upload-zone"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    hidden
                  />

                  {selectedImage ? (
                    <div className="image-preview">
                      <img src={selectedImage} alt="Preview" />
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <p><strong>Click to upload</strong> or drag and drop</p>
                      <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>PNG, JPG, BMP supported</p>
                    </div>
                  )}
                </div>
              )}

              {!showCamera && (
                <button
                  className="btn secondary-btn"
                  onClick={startCamera}
                  style={{ width: '100%', marginTop: '1rem', background: 'rgba(255, 255, 255, 0.1)' }}
                >
                  📸 Use Camera
                </button>
              )}
            </div>

            <button
              className="btn"
              onClick={generateImage}
              disabled={loading || !base64Image}
            >
              {loading ? <div className="loading-spinner"></div> : "Generate Transformation"}
            </button>

            {error && (
              <div style={{ marginTop: '1rem', color: 'var(--error)', background: 'rgba(248, 113, 113, 0.1)', padding: '1rem', borderRadius: '8px' }}>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Output */}
        <div className="output-column">
          {renderOutput()}
          {!result && !loading && (
            <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--text-secondary)', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p>Generated results will appear here.</p>
            </div>
          )}
          {loading && (
            <div className="glass-panel" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="loading-spinner" style={{ width: '50px', height: '50px', borderTopColor: 'var(--accent-primary)' }}></div>
            </div>
          )}
        </div>
      </div>
    </div >
  );
}

export default App;
