import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine, ArrowLeftRight, Box, Check, ChevronDown, FileBox,
  FileUp, Layers3, LoaderCircle, LogIn, LogOut, ShieldCheck, Sparkles, X,
} from 'lucide-react'
import { convertModel } from './services/converter.js'
import { auth } from './services/firebase.js'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import './App.css'

const formats = ['OBJ', 'STL', 'GLB', 'GLTF', 'PLY', '3MF', 'FBX', 'USDZ']
const outputFormats = ['OBJ', 'STL', 'GLB', 'GLTF', 'PLY', '3MF']
const conversions = {
  GLB: [{ format: 'STL', purpose: '3D printing' }, { format: 'OBJ', purpose: '3D modelling' }, { format: 'PLY', purpose: 'Point cloud and mesh tools' }, { format: '3MF', purpose: '3D printing' }],
  GLTF: [{ format: 'GLB', purpose: 'Single-file export' }, { format: 'OBJ', purpose: '3D modelling' }, { format: 'STL', purpose: '3D printing' }, { format: 'PLY', purpose: 'Point cloud and mesh tools' }],
  OBJ: [{ format: 'GLB', purpose: 'Web visualization' }, { format: 'STL', purpose: '3D printing' }, { format: 'GLTF', purpose: 'Web 3D' }, { format: 'PLY', purpose: 'Point cloud and mesh tools' }],
  FBX: [{ format: 'GLB', purpose: 'Web 3D' }],
  STL: [{ format: 'OBJ', purpose: 'Mesh editing' }, { format: 'GLB', purpose: 'Web visualization' }, { format: 'GLTF', purpose: 'Web 3D' }, { format: 'PLY', purpose: 'Point cloud and mesh tools' }],
  PLY: [{ format: 'STL', purpose: '3D printing' }, { format: 'OBJ', purpose: 'Mesh editing' }, { format: 'GLB', purpose: 'Web visualization' }, { format: 'GLTF', purpose: 'Web 3D' }],
  '3MF': [{ format: 'STL', purpose: '3D printing' }, { format: 'OBJ', purpose: 'Mesh editing' }, { format: 'GLB', purpose: 'Web visualization' }, { format: 'GLTF', purpose: 'Web 3D' }],
  USDZ: [{ format: 'GLB', purpose: 'Web 3D' }],
}
const acceptedFiles = '.obj,.stl,.glb,.gltf,.ply,.3mf,.fbx,.usdz'

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function App() {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [targetFormat, setTargetFormat] = useState('GLB')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [authUser, setAuthUser] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')

  useEffect(() => onAuthStateChanged(auth, setAuthUser), [])

  const openAuth = (mode = 'login') => {
    setAuthMode(mode)
    setAuthError('')
    setAuthNotice('')
    setAuthOpen(true)
  }

  const submitAuth = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = formData.get('email')?.toString().trim()
    const password = formData.get('password')?.toString()
    setAuthBusy(true)
    setAuthError('')
    setAuthNotice('')
    try {
      if (authMode === 'reset') {
        await sendPasswordResetEmail(auth, email)
        setAuthNotice('Password reset email sent. Check your inbox.')
      } else if (authMode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password)
        setAuthOpen(false)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
        setAuthOpen(false)
      }
    } catch (error) {
      const messages = {
        'auth/invalid-credential': 'Email or password is incorrect.',
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/weak-password': 'Use a password with at least 6 characters.',
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/network-request-failed': 'Could not reach Firebase. Check your connection and try again.',
        'auth/operation-not-allowed': 'Email and password sign-in is not enabled in Firebase yet.',
      }
      setAuthError(messages[error.code] || 'Authentication failed. Please try again.')
    } finally {
      setAuthBusy(false)
    }
  }

  const selectFile = (nextFile) => {
    if (!nextFile) return
    const extension = nextFile.name.split('.').pop()?.toLowerCase()
    if (!formats.map((format) => format.toLowerCase()).includes(extension)) {
      setError('Choose an OBJ, STL, GLB, GLTF, PLY, 3MF, FBX, or USDZ file.')
      return
    }
    if (nextFile.size > 100 * 1024 * 1024) {
      setError('This file is larger than the 100 MB limit.')
      return
    }
    setFile(nextFile)
    setError('')
    setResult(null)
    setStatus('idle')
    setTargetFormat(conversions[extension.toUpperCase()][0].format)
  }

  const runConversion = async () => {
    if (!file) {
      inputRef.current?.click()
      return
    }
    setStatus('converting')
    setError('')
    setResult(null)
    try {
      const converted = await convertModel(file, targetFormat.toLowerCase())
      const fallbackExtension = targetFormat === 'GLTF' ? 'zip' : targetFormat.toLowerCase()
      setResult({
        blob: converted.blob,
        filename: converted.filename || `${file.name.replace(/\.[^.]+$/, '')}.${fallbackExtension}`,
      })
      setStatus('done')
    } catch (conversionError) {
      setError(conversionError.message)
      setStatus('error')
    }
  }

  const downloadResult = () => {
    if (!result) return
    const url = URL.createObjectURL(result.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = result.filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const sourceFormat = file?.name.split('.').pop()?.toUpperCase()
  const availableConversions = sourceFormat ? conversions[sourceFormat] : null
  const selectedConversion = availableConversions?.find(({ format }) => format === targetFormat)

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="TriConvert home">
          <span className="brand-mark"><Layers3 size={20} strokeWidth={2.3} /></span>
          <span>tri<span>convert</span></span>
        </a>
        <div className="topbar-right">
          <span className="format-note"><span className="live-dot" /> 3D CONVERTER · 26 ROUTES</span>
          <button className="auth-button" type="button" onClick={() => authUser ? signOut(auth) : openAuth()}>
            {authUser ? <><LogOut size={15} /> Sign out</> : <><LogIn size={15} /> Login</>}
          </button>
          <a className="github-link" href="#converter">Start converting <Sparkles size={14} /></a>
        </div>
      </header>

      {authOpen && <div className="auth-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false) }}>
        <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button className="auth-close" type="button" aria-label="Close sign-in" onClick={() => setAuthOpen(false)}><X size={18} /></button>
          <span className="auth-mark"><Layers3 size={21} /></span>
          <h2 id="auth-title">{authMode === 'signup' ? 'Create your account' : authMode === 'reset' ? 'Reset your password' : 'Welcome back'}</h2>
          <p>{authMode === 'signup' ? 'Sign up to get started with TriConvert.' : authMode === 'reset' ? 'We’ll email you a link to reset your password.' : 'Sign in to your TriConvert account.'}</p>
          <form className="auth-form" onSubmit={submitAuth}>
            <label htmlFor="auth-email">Email address</label>
            <input id="auth-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
            {authMode !== 'reset' && <>
              <label htmlFor="auth-password">Password</label>
              <input id="auth-password" name="password" type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} minLength="6" placeholder="At least 6 characters" required />
            </>}
            {authError && <div className="auth-message auth-error" role="alert">{authError}</div>}
            {authNotice && <div className="auth-message auth-success" role="status">{authNotice}</div>}
            <button className="auth-submit" type="submit" disabled={authBusy}>
              {authBusy ? <><LoaderCircle className="spin" size={16} /> Please wait</> : authMode === 'signup' ? 'Create account' : authMode === 'reset' ? 'Send reset email' : 'Sign in'}
            </button>
          </form>
          <div className="auth-options">
            {authMode === 'login' && <button type="button" onClick={() => openAuth('reset')}>Forgot password?</button>}
            {authMode === 'signup' ? <button type="button" onClick={() => openAuth('login')}>Already have an account? Sign in</button> : authMode === 'login' && <button type="button" onClick={() => openAuth('signup')}>New to TriConvert? Create an account</button>}
            {authMode === 'reset' && <button type="button" onClick={() => openAuth('login')}>Back to sign in</button>}
          </div>
        </section>
      </div>}

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span /> YOUR MODELS, EVERYWHERE</div>
            <h1>One model.<br /><span>Any format.</span></h1>
            <p className="hero-description">Convert 3D files in seconds. Simple, secure, and ready for whatever you’re building next.</p>
            <div className="supported-formats" aria-label="Supported formats">
              {formats.map((format) => <span key={format}>{format}</span>)}
              <span className="format-caption">SUPPORTED FORMATS</span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
            <div className="art-glow" />
            <div className="art-cube"><Box size={110} strokeWidth={0.75} /></div>
            <div className="float-tag tag-obj">.OBJ</div><div className="float-tag tag-gltf">.GLTF</div>
            <div className="float-tag tag-stl">.STL</div>
            <div className="art-cross cross-one">✳</div><div className="art-cross cross-two">✦</div>
          </div>
        </section>

        <section id="converter" className="converter-card" aria-label="Convert a 3D model">
          <div className="card-heading">
            <div className="card-icon"><ArrowLeftRight size={19} /></div>
            <div><h2>Let’s convert</h2><p>26 supported conversions across 8 model formats.</p></div>
            <span className="step-label">01 <i /> 02 <i /> 03</span>
          </div>

          <button
            className={`drop-zone ${dragging ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`}
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]) }}
          >
            <input ref={inputRef} type="file" accept={acceptedFiles} hidden onChange={(event) => { selectFile(event.target.files[0]); event.target.value = '' }} />
            <span className="upload-icon"><FileUp size={23} /></span>
            <span className="drop-copy">
              <strong>{file ? file.name : 'Drop your 3D file here'}</strong>
              <small>{file ? `${formatSize(file.size)} · ${sourceFormat} model` : <>or <u>browse files</u> from your device</>}</small>
            </span>
            {file ? <span className="file-check"><Check size={17} /></span> : <span className="file-types">OBJ · STL · GLB · GLTF · PLY · 3MF · FBX · USDZ</span>}
          </button>

          <div className="conversion-row">
            <div className="format-field">
              <label>OUTPUT FORMAT</label>
              <div className="format-select-wrap"><FileBox size={17} /><select value={targetFormat} onChange={(event) => setTargetFormat(event.target.value)}>
                {(availableConversions || outputFormats.map((format) => ({ format, purpose: '' }))).map(({ format, purpose }) => <option key={format} value={format}>{format}{purpose ? ` · ${purpose}` : ' format'}</option>)}
              </select><ChevronDown size={16} /></div>
              {selectedConversion && <span className="purpose-note">For {selectedConversion.purpose.toLowerCase()}</span>}
            </div>
            <div className="arrow-divider"><ArrowLeftRight size={18} /></div>
            <div className="privacy-note"><ShieldCheck size={18} /><span><strong>Private by design</strong><small>Files are processed and discarded.</small></span></div>
            <button className="convert-button" type="button" disabled={status === 'converting'} onClick={runConversion}>
              {status === 'converting' ? <><LoaderCircle className="spin" size={17} /> Converting</> : status === 'done' ? <><Check size={17} /> Convert again</> : <>Convert model <span>↗</span></>}
            </button>
          </div>

          {error && <div className="feedback error-feedback" role="alert"><X size={16} /> {error}</div>}
          {status === 'done' && result && <div className="feedback success-feedback" role="status"><Check size={17} /><span><strong>Your {targetFormat} is ready.</strong> {result.filename}</span><button type="button" onClick={downloadResult}><ArrowDownToLine size={16} /> Download</button></div>}
        </section>

        <p className="engine-note">FBX and USDZ conversions need Blender installed on the server.</p>
        <div className="trust-row"><span><ShieldCheck size={15} /> No account needed</span><b /> <span>Free to use</span><b /> <span>Up to 100 MB per file</span></div>

        <section className="how-section">
          <div className="section-title"><span>STRAIGHTFORWARD BY DESIGN</span><h2>From here to there.</h2></div>
          <div className="steps-grid">
            <article><span className="step-number">01</span><div className="step-icon"><FileUp size={20} /></div><h3>Choose a model</h3><p>Pick an OBJ, STL, GLB, or GLTF file from your device.</p></article>
            <article><span className="step-number">02</span><div className="step-icon"><ArrowLeftRight size={20} /></div><h3>Pick a format</h3><p>Choose the format that fits your workflow best.</p></article>
            <article><span className="step-number">03</span><div className="step-icon"><ArrowDownToLine size={20} /></div><h3>Keep creating</h3><p>Download your converted model and get back to making.</p></article>
          </div>
        </section>
      </main>

      <footer><a className="brand footer-brand" href="#top"><span className="brand-mark"><Layers3 size={17} /></span><span>tri<span>convert</span></span></a><span>Made for the things you make.</span><span className="footer-status"><i /> READY WHEN YOU ARE</span></footer>
    </div>
  )
}

export default App
