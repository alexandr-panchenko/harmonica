// --- Harmonica Note Trainer Application Logic ---

// Configuration Settings
const currentSettings = {
  range: 'full',        // 'full', 'low', 'mid', 'high', 'low-mid', 'mid-high'
  spelling: 'random',   // 'random', 'sharps', 'flats'
  accidentals: true,    // Include slide-in notes
  sound: true,          // Audio synthesis
  showLabels: true      // Note name helper labels on harmonica
};

// Game/UI State
const currentGameState = {
  score: 0,
  totalAttempts: 0,
  streak: 0,
  correctAnswers: 0,
  speedSum: 0,          // Accumulate time to calculate average speed
  
  // Harmonica State
  breath: 'blow',       // 'blow' or 'draw'
  slide: false,         // true = pressed (slide in), false = released (slide out)
  
  // Current Question Details
  targetMidi: null,
  targetName: null,
  targetAbc: null,
  startTime: null,
  lastSpellingStyle: 'sharps', // Track whether current note is spelled sharp or flat
  
  isTransitioning: false // Lock controls during feedback animations
};

// Audio variables
let audioCtx = null;
let currentOscillator = null;

// --- Learn a Song Mode State & Database ---
let currentMode = 'quiz'; // 'quiz' or 'song'
let currentSongKey = 'twinkle';
let songNotes = []; // Extracted note items: { midi, duration }
let currentSongNoteIndex = 0;

let playbackInterval = null;
let isPlayingSong = false;
let playbackTempoBpm = 100;

// Preloaded Songs Database (Transposed to Key of C, playable on C4-C7 range)
const SONG_DATABASE = {
  twinkle: {
    name: "Twinkle Twinkle Little Star",
    abc: "X:1\nL:1/4\nK:C\nC C G G | A A G2 | F F E E | D D C2 | G G F F | E E D2 | G G F F | E E D2 | C C G G | A A G2 | F F E E | D D C2"
  },
  ode: {
    name: "Ode to Joy",
    abc: "X:1\nL:1/4\nK:C\nE E F G | G F E D | C C D E | E3/2D/2 D2 | E E F G | G F E D | C C D E | D3/2C/2 C2 | D D E C | D E/2F/2 E C | D E/2F/2 E D | C D G2 | E E F G | G F E D | C C D E | D3/2C/2 C2"
  },
  birthday: {
    name: "Happy Birthday",
    abc: "X:1\nL:1/4\nK:C\nC3/2C/2 D C F | E2 z | C3/2C/2 D C G | F2 z | C3/2C/2 c A F E | D2 B3/2B/2 A F G | F2"
  },
  grace: {
    name: "Amazing Grace",
    abc: "X:1\nL:1/4\nK:C\nC | F2 A/2F/2 A2 | G2 F | D2 C2 | C | F2 A/2F/2 A2 | G2 A | c3 | A | c2 A/2F/2 A2 | G2 F | D2 C2 | C | F2 A/2F/2 F2 | G2 F"
  }
};


// --- 1. Harmonica Note Layout Formulas ---

/**
 * Calculates the MIDI note for a given hole, breath direction, and slide button state
 * using standard Solo Tuning in the Key of C.
 */
function getNoteForHole(hole, breath, slide) {
  const group = Math.floor((hole - 1) / 4); // 0 (Holes 1-4), 1 (Holes 5-8), 2 (Holes 9-12)
  const subHole = (hole - 1) % 4 + 1;       // 1, 2, 3, or 4
  
  // Base MIDI notes for group 0 (Octave 4)
  let baseMIDI = 60; // Default C4
  
  switch (subHole) {
    case 1: // C-D pattern
      if (breath === 'blow') {
        baseMIDI = slide ? 61 : 60; // C -> C#
      } else {
        baseMIDI = slide ? 63 : 62; // D -> D#
      }
      break;
    case 2: // E-F pattern
      if (breath === 'blow') {
        baseMIDI = slide ? 65 : 64; // E -> F (E#)
      } else {
        baseMIDI = slide ? 66 : 65; // F -> F#
      }
      break;
    case 3: // G-A pattern
      if (breath === 'blow') {
        baseMIDI = slide ? 68 : 67; // G -> G#
      } else {
        baseMIDI = slide ? 70 : 69; // A -> A#
      }
      break;
    case 4: // C-B pattern (Note: B is lower than C, so blow is C5, draw is B4)
      if (breath === 'blow') {
        baseMIDI = slide ? 73 : 72; // C5 -> C#5
      } else {
        baseMIDI = slide ? 72 : 71; // B4 -> C5 (B#4)
      }
      break;
  }
  
  return baseMIDI + (group * 12);
}

/**
 * Finds all combinations of (hole, breath, slide) that produce a specific MIDI note.
 * Useful for checking answers since notes like C5 and F4 have duplicate placements.
 */
function getCombinationsForMidi(midi) {
  const matches = [];
  for (let hole = 1; hole <= 12; hole++) {
    for (const breath of ['blow', 'draw']) {
      for (const slide of [false, true]) {
        if (getNoteForHole(hole, breath, slide) === midi) {
          matches.push({ hole, breath, slide });
        }
      }
    }
  }
  return matches;
}

// --- 2. ABC Music Notation Converter ---

/**
 * Converts a MIDI note number to its ABC Notation string and human-readable name.
 * spelling can be: 'sharps' or 'flats'
 */
function getABCNotation(midi, spelling = 'sharps') {
  const pitchClass = midi % 12;
  const octave = Math.floor(midi / 12) - 1; // MIDI 60 (Middle C) -> Octave 4
  
  const sharpNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const flatNames = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  
  const isAccidental = [1, 3, 6, 8, 10].includes(pitchClass);
  const name = (spelling === 'flats') ? flatNames[pitchClass] : sharpNames[pitchClass];
  
  let letter = "";
  let accidental = "";
  
  if (!isAccidental) {
    letter = sharpNames[pitchClass];
  } else {
    if (spelling === 'flats') {
      accidental = "_"; // Flat symbol in ABC
      if (pitchClass === 1) letter = "D";       // Db
      else if (pitchClass === 3) letter = "E";  // Eb
      else if (pitchClass === 6) letter = "G";  // Gb
      else if (pitchClass === 8) letter = "A";  // Ab
      else if (pitchClass === 10) letter = "B"; // Bb
    } else {
      accidental = "^"; // Sharp symbol in ABC
      if (pitchClass === 1) letter = "C";       // C#
      else if (pitchClass === 3) letter = "D";  // D#
      else if (pitchClass === 6) letter = "F";  // F#
      else if (pitchClass === 8) letter = "G";  // G#
      else if (pitchClass === 10) letter = "A"; // A#
    }
  }
  
  // Transform letter and octave to ABC format
  let abcLetter = "";
  if (octave === 4) {
    abcLetter = letter; // C, D, E...
  } else if (octave === 5) {
    abcLetter = letter.toLowerCase(); // c, d, e...
  } else if (octave === 6) {
    abcLetter = letter.toLowerCase() + "'"; // c', d', e'...
  } else if (octave === 7) {
    abcLetter = letter.toLowerCase() + "''"; // c'', d'', e''...
  }
  
  return {
    abc: accidental + abcLetter,
    name: name + octave,
    midi: midi
  };
}

// --- 3. Web Audio Synthesis ---

/**
 * Initializes the Web Audio API context on user action.
 */
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/**
 * Plays a MIDI note using a synthesized wave.
 */
function playNoteSound(midi, duration = 1.0) {
  if (!currentSettings.sound) return;
  initAudio();
  
  try {
    const now = audioCtx.currentTime;
    
    // Stop currently running note to avoid overlaps
    if (currentOscillator) {
      try {
        currentOscillator.stop(now);
      } catch (err) {}
      currentOscillator = null;
    }
    
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // Wind/Harmonica-like sound profile: Triangle wave
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    
    // Add subtle vibrato (pitch modulation)
    const vibrato = audioCtx.createOscillator();
    const vibratoGain = audioCtx.createGain();
    vibrato.frequency.value = 5.5; // 5.5Hz vibrato rate
    vibratoGain.gain.value = 1.5; // Frequency variance
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    
    // Envelope: Fast attack, smooth decay
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.05); // Attack
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration); // Decay
    
    vibrato.start(now);
    osc.start(now);
    
    vibrato.stop(now + duration);
    osc.stop(now + duration + 0.05);
    
    currentOscillator = osc;
  } catch (e) {
    console.error("Audio Synthesis error: ", e);
  }
}

/**
 * Plays the target note audio.
 */
function playTargetSound() {
  if (currentGameState.targetMidi) {
    playNoteSound(currentGameState.targetMidi, 1.2);
  }
}

// --- 4. Game Logic & Question Generation ---

/**
 * Generates all playable MIDI notes based on the chosen range & accidental settings.
 */
function generateCandidateMidis() {
  let holes = [];
  switch (currentSettings.range) {
    case 'low':       holes = [1, 2, 3, 4]; break;
    case 'mid':       holes = [5, 6, 7, 8]; break;
    case 'high':      holes = [9, 10, 11, 12]; break;
    case 'low-mid':   holes = [1, 2, 3, 4, 5, 6, 7, 8]; break;
    case 'mid-high':  holes = [5, 6, 7, 8, 9, 10, 11, 12]; break;
    case 'full':
    default:          holes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }
  
  const midiSet = new Set();
  
  for (const hole of holes) {
    for (const breath of ['blow', 'draw']) {
      for (const slide of [false, true]) {
        const midi = getNoteForHole(hole, breath, slide);
        midiSet.add(midi);
      }
    }
  }
  
  let candidates = Array.from(midiSet);
  
  // Filter out slide-in accidentals if they are disabled in settings
  if (!currentSettings.accidentals) {
    candidates = candidates.filter(midi => {
      const combinations = getCombinationsForMidi(midi);
      // Keep the note if it can be played with slide out
      return combinations.some(combo => combo.slide === false);
    });
  }
  
  return candidates;
}

/**
 * Presents a new sheet music note to the user.
 */
function nextQuestion() {
  if (currentGameState.isTransitioning) return;
  
  const candidates = generateCandidateMidis();
  if (candidates.length === 0) {
    alert("No playable notes match your current range configuration. Try expanding your settings!");
    return;
  }
  
  // Select random midi from candidate list, avoiding immediate repeats if possible
  let nextMidi = candidates[Math.floor(Math.random() * candidates.length)];
  if (candidates.length > 1 && nextMidi === currentGameState.targetMidi) {
    nextMidi = candidates[Math.floor(Math.random() * candidates.length)];
  }
  
  // Choose spelling format (sharps vs flats)
  let spelling = currentSettings.spelling;
  if (spelling === 'random') {
    spelling = Math.random() < 0.5 ? 'sharps' : 'flats';
  }
  currentGameState.lastSpellingStyle = spelling;
  
  const noteInfo = getABCNotation(nextMidi, spelling);
  
  currentGameState.targetMidi = nextMidi;
  currentGameState.targetName = noteInfo.name;
  currentGameState.targetAbc = noteInfo.abc;
  currentGameState.startTime = Date.now();
  
  // Render sheet music using ABCJS
  renderSheetMusic(noteInfo.abc);
  
  // Update note letters displayed on the visual harmonica holes
  updateHarmonicaLabels(spelling);
  
  // Hide feedback overlay
  document.getElementById('feedback-overlay').classList.remove('active');
  
  // Clear any temporary active states on harmonica holes
  document.querySelectorAll('.harmonica-hole').forEach(el => {
    el.classList.remove('active-playing');
  });
  
  // Play note sound automatically if configured AND audio is already initialized
  if (currentSettings.sound && audioCtx && audioCtx.state === 'running') {
    setTimeout(() => {
      playNoteSound(nextMidi, 1.2);
    }, 150);
  }
}

/**
 * Renders the music sheet using the ABCJS library.
 */
function renderSheetMusic(abcNote) {
  const abcString = `X:1\nL:1/4\nK:C\n${abcNote}4`;
  
  // Responsive scale to prevent sheet music overflow on mobile screens
  const isMobile = window.innerWidth <= 768;
  const renderScale = isMobile ? 1.05 : 1.4;
  const renderWidth = isMobile ? 220 : 260;
  
  try {
    ABCJS.renderAbc("sheet-container", abcString, {
      scale: renderScale,
      add_classes: true,
      staffwidth: renderWidth
    });
  } catch (err) {
    console.error("ABCJS render error: ", err);
  }
}

/**
 * Checks if the user's selected hole matches the target sheet note.
 */
function submitAnswer(hole) {
  if (currentGameState.isTransitioning) return;
  
  if (currentMode === 'song') {
    submitSongNote(hole);
    return;
  }
  
  const breath = currentGameState.breath;
  const slide = currentGameState.slide;
  
  // Calculate the note played by the user's action
  const playedMidi = getNoteForHole(hole, breath, slide);
  const correct = (playedMidi === currentGameState.targetMidi);
  
  currentGameState.totalAttempts++;
  
  const holeElement = document.querySelector(`.harmonica-hole[data-hole="${hole}"]`);
  const overlay = document.getElementById('feedback-overlay');
  const icon = document.getElementById('feedback-icon');
  const text = document.getElementById('feedback-text');
  const subtext = document.getElementById('feedback-subtext');
  
  currentGameState.isTransitioning = true;
  
  // Play the sound of what the user selected
  playNoteSound(playedMidi, 1.0);
  
  if (correct) {
    currentGameState.correctAnswers++;
    currentGameState.streak++;
    
    // Points system with speed bonus
    const responseSpeed = (Date.now() - currentGameState.startTime) / 1000;
    currentGameState.speedSum += responseSpeed;
    const speedBonus = Math.max(0, Math.round((3.0 - responseSpeed) * 5));
    const scoreGain = 10 + speedBonus;
    currentGameState.score += scoreGain;
    
    // Visual feedback
    if (holeElement) {
      holeElement.classList.add('correct-flash');
      setTimeout(() => holeElement.classList.remove('correct-flash'), 500);
    }
    
    overlay.className = "feedback-overlay success active";
    icon.textContent = "✓";
    text.textContent = `Correct! (+${scoreGain} pts)`;
    
    // Find all valid ways to play this note to show standard options
    const options = getCombinationsForMidi(currentGameState.targetMidi);
    const optionsText = options.map(opt => {
      return `Hole ${opt.hole} ${opt.breath.toUpperCase()}${opt.slide ? ' + Slide' : ''}`;
    }).join(' or ');
    
    subtext.textContent = `${currentGameState.targetName} • Played via: ${optionsText}`;
    
    // Auto advance to next question
    setTimeout(() => {
      currentGameState.isTransitioning = false;
      nextQuestion();
    }, 1400);
    
  } else {
    // Incorrect answer
    currentGameState.streak = 0;
    
    // Register played note name for feedback display
    const playedInfo = getABCNotation(playedMidi, currentGameState.lastSpellingStyle);
    
    if (holeElement) {
      holeElement.classList.add('wrong-flash');
      setTimeout(() => holeElement.classList.remove('wrong-flash'), 500);
    }
    
    overlay.className = "feedback-overlay error active";
    icon.textContent = "✗";
    text.textContent = `Incorrect!`;
    
    const correctOptions = getCombinationsForMidi(currentGameState.targetMidi);
    const correctText = correctOptions.map(opt => {
      return `Hole ${opt.hole} ${opt.breath.toUpperCase()}${opt.slide ? ' + Slide' : ''}`;
    }).join(' or ');
    
    subtext.textContent = `Target: ${currentGameState.targetName} (${correctText}) • You played: ${playedInfo.name}`;
    
    // Play the target note again quickly after the played note so they can hear the contrast
    setTimeout(() => {
      if (currentSettings.sound) {
        playNoteSound(currentGameState.targetMidi, 1.0);
      }
    }, 600);
    
    // Auto advance after a slightly longer delay so they can absorb the mistake
    setTimeout(() => {
      currentGameState.isTransitioning = false;
      nextQuestion();
    }, 2800);
  }
  
  updateStatsUI();
}

// --- 4b. Learn a Song Mode Core Logic ---

/**
 * Toggles the app mode between Quiz and Song Learning mode.
 */
function switchMode(mode) {
  if (currentMode === mode) return;
  
  // Stop any active song playback
  stopSongPlayback();
  
  currentMode = mode;
  
  const quizBtn = document.getElementById('btn-mode-quiz');
  const songBtn = document.getElementById('btn-mode-song');
  const songPanel = document.getElementById('song-control-panel');
  const playButtons = document.querySelector('.sheet-buttons-container');
  
  if (mode === 'song') {
    quizBtn.classList.remove('active');
    songBtn.classList.add('active');
    songPanel.classList.remove('hidden');
    if (playButtons) playButtons.classList.add('hidden'); // Hide Skip/Hear Pitch buttons in Song mode
    
    // Load the currently selected song
    loadActiveSong();
  } else {
    quizBtn.classList.add('active');
    songBtn.classList.remove('active');
    songPanel.classList.add('hidden');
    if (playButtons) playButtons.classList.remove('hidden'); // Show Skip/Hear Pitch buttons in Quiz mode
    
    // Reset quiz stats and trigger a new question
    nextQuestion();
  }
}

/**
 * Loads the currently selected preloaded song (or custom song editor).
 */
function loadActiveSong() {
  const songSelector = document.getElementById('select-song');
  const customLoader = document.getElementById('custom-song-loader');
  const songKey = songSelector.value;
  
  currentSongKey = songKey;
  
  if (songKey === 'custom') {
    customLoader.classList.remove('hidden');
    // Render an empty staff or load whatever is in the textarea
    const customAbc = document.getElementById('txt-custom-abc').value.trim();
    if (customAbc) {
      loadCustomSong(customAbc);
    } else {
      // Clear sheet music staff
      document.getElementById('sheet-container').innerHTML = 
        `<div style="color: var(--text-muted); font-family: var(--font-sans); font-size: 0.9rem; padding: 1rem;">Paste your ABC notation below and click Load!</div>`;
      songNotes = [];
      updateSongProgressUI();
    }
  } else {
    customLoader.classList.add('hidden');
    const song = SONG_DATABASE[songKey];
    if (song) {
      loadSongString(song.abc, song.name);
    }
  }
}

/**
 * Loads a song from a raw ABC notation string.
 */
function loadSongString(abcString, songName) {
  stopSongPlayback();
  
  try {
    // Render the song using ABCJS
    const visualObjs = ABCJS.renderAbc("sheet-container", abcString, {
      scale: window.innerWidth <= 768 ? 1.05 : 1.4,
      add_classes: true,
      staffwidth: window.innerWidth <= 768 ? 220 : 260
    });
    
    // Extract the note MIDI sequence
    songNotes = extractNotesFromVisualObj(visualObjs);
    currentSongNoteIndex = 0;
    
    if (songNotes.length === 0) {
      alert("No notes could be parsed from this song. Please check the ABC syntax!");
      return;
    }
    
    // Highlight the starting note
    highlightActiveSongNote();
    updateSongProgressUI();
    
  } catch (err) {
    console.error("Error loading song: ", err);
    alert("Failed to render the song. Make sure it is valid ABC notation.");
  }
}

/**
 * Parses custom song ABC notation and loads it.
 */
function loadCustomSong(customAbc) {
  // Wrap simple raw note letters inside a minimal ABC header if needed
  let abcString = customAbc;
  if (!abcString.includes("K:")) {
    // Treat as raw notes, auto wrap in basic ABC structure
    abcString = `X:1\nL:1/4\nK:C\n${customAbc}`;
  }
  loadSongString(abcString, "Custom Song");
}

/**
 * Extracts note event details sequentially from the rendered abcjs visualObj.
 */
function extractNotesFromVisualObj(visualObjs) {
  const notes = [];
  if (!visualObjs || !visualObjs[0] || !visualObjs[0].lines) return notes;
  
  visualObjs[0].lines.forEach(line => {
    if (!line.staff) return;
    line.staff.forEach(staff => {
      if (!staff.voices) return;
      staff.voices.forEach(voice => {
        voice.forEach(event => {
          // Look for notes, filter out rests (rests don't have event.pitches)
          if (event.el_type === "note" && event.pitches && event.pitches.length > 0) {
            const pitchObj = event.pitches[0];
            const step = pitchObj.pitch;
            
            // Map the step (0 represents C4, 7 represents C5, 14 represents C6) to standard MIDI
            const baseMidi = 60 + Math.floor(step / 7) * 12 + [0, 2, 4, 5, 7, 9, 11][((step % 7) + 7) % 7];
            let midi = baseMidi;
            
            // Adjust for accidentals
            if (pitchObj.accidental === 'sharp') {
              midi += 1;
            } else if (pitchObj.accidental === 'flat') {
              midi -= 1;
            }
            
            notes.push({
              midi: midi,
              duration: event.duration
            });
          }
        });
      });
    });
  });
  return notes;
}

/**
 * Highlights the note at currentSongNoteIndex in the sheet music SVG
 * and plays its sound to guide the user.
 */
function highlightActiveSongNote() {
  const noteElements = document.querySelectorAll('#sheet-container .abcjs-note');
  
  // Clear previous active styling
  noteElements.forEach(el => {
    el.classList.remove('active-note-head');
    el.setAttribute('fill', 'currentColor');
    el.setAttribute('stroke', 'none');
  });
  
  if (noteElements.length > 0 && currentSongNoteIndex < noteElements.length) {
    const activeEl = noteElements[currentSongNoteIndex];
    activeEl.classList.add('active-note-head');
    activeEl.setAttribute('fill', 'var(--primary)');
    activeEl.setAttribute('stroke', 'var(--primary)');
    
    // Auto-scroll long songs horizontally to keep the active note centered
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    
    // Play pitch audio automatically if enabled and we are not in automated playback mode
    if (currentSettings.sound && !isPlayingSong) {
      // Small timeout to prevent clipping if click sound is playing
      setTimeout(() => {
        if (currentMode === 'song' && !isPlayingSong) {
          playNoteSound(songNotes[currentSongNoteIndex].midi, 0.8);
        }
      }, 50);
    }
  }
}

/**
 * Processes note entry when playing a song.
 */
function submitSongNote(hole) {
  if (songNotes.length === 0 || isPlayingSong || currentGameState.isTransitioning) return;
  
  const breath = currentGameState.breath;
  const slide = currentGameState.slide;
  const playedMidi = getNoteForHole(hole, breath, slide);
  
  const targetNote = songNotes[currentSongNoteIndex];
  const correct = (playedMidi === targetNote.midi);
  
  const holeElement = document.querySelector(`.harmonica-hole[data-hole="${hole}"]`);
  
  // Play note sound played
  playNoteSound(playedMidi, 0.8);
  
  if (correct) {
    if (holeElement) {
      holeElement.classList.add('correct-flash');
      setTimeout(() => holeElement.classList.remove('correct-flash'), 300);
    }
    
    currentSongNoteIndex++;
    updateSongProgressUI();
    
    if (currentSongNoteIndex >= songNotes.length) {
      showSongCompletionMessage();
    } else {
      highlightActiveSongNote();
    }
  } else {
    if (holeElement) {
      holeElement.classList.add('wrong-flash');
      setTimeout(() => holeElement.classList.remove('wrong-flash'), 300);
    }
    // Don't advance, let them try again immediately
  }
}

/**
 * Updates the progress indicator values and bar fill width.
 */
function updateSongProgressUI() {
  const total = songNotes.length;
  const current = currentSongNoteIndex;
  
  const progressText = document.getElementById('lbl-song-progress');
  const progressFill = document.getElementById('progress-bar-fill');
  
  if (progressText) {
    progressText.textContent = total > 0 ? `Note ${current} of ${total}` : 'Note 0 of 0';
  }
  if (progressFill) {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    progressFill.style.width = `${percentage}%`;
  }
}

/**
 * Plays a congratulations overlay when the melody finishes.
 */
function showSongCompletionMessage() {
  const overlay = document.getElementById('feedback-overlay');
  const icon = document.getElementById('feedback-icon');
  const text = document.getElementById('feedback-text');
  const subtext = document.getElementById('feedback-subtext');
  
  overlay.className = "feedback-overlay success active";
  icon.textContent = "🎉";
  text.textContent = "Song Completed!";
  subtext.textContent = "Awesome job! Click anywhere to reset.";
  
  currentGameState.isTransitioning = true;
  
  // Dismiss listener
  overlay.addEventListener('click', function dismiss() {
    overlay.removeEventListener('click', dismiss);
    overlay.classList.remove('active');
    currentGameState.isTransitioning = false;
    resetSong();
  });
}

/**
 * Resets the current song back to note index 0.
 */
function resetSong() {
  stopSongPlayback();
  currentSongNoteIndex = 0;
  highlightActiveSongNote();
  updateSongProgressUI();
}

/**
 * Playback sequencing player (Listen Mode).
 */
function toggleSongPlayback() {
  if (songNotes.length === 0) return;
  
  const playBtn = document.getElementById('btn-song-play');
  const playIcon = document.getElementById('svg-play');
  const playText = document.getElementById('txt-play');
  
  if (isPlayingSong) {
    stopSongPlayback();
  } else {
    isPlayingSong = true;
    if (playText) playText.textContent = "Pause";
    if (playIcon) {
      playIcon.innerHTML = `<rect x="4" y="4" width="4" height="16" fill="currentColor"></rect><rect x="12" y="4" width="4" height="16" fill="currentColor"></rect>`;
    }
    
    // Start index back at 0 if we were at the end
    if (currentSongNoteIndex >= songNotes.length) {
      currentSongNoteIndex = 0;
    }
    
    // Interval calculations based on BPM
    // One quarter note beat in ms is: 60000 / BPM
    const intervalMs = (60000 / playbackTempoBpm);
    
    playbackInterval = setInterval(() => {
      if (currentSongNoteIndex < songNotes.length) {
        highlightActiveSongNote();
        playNoteSound(songNotes[currentSongNoteIndex].midi, intervalMs / 1000 * 0.9);
        currentSongNoteIndex++;
        updateSongProgressUI();
      } else {
        stopSongPlayback();
      }
    }, intervalMs);
  }
}

/**
 * Stops melody playback and resets play button state.
 */
function stopSongPlayback() {
  if (playbackInterval) {
    clearInterval(playbackInterval);
    playbackInterval = null;
  }
  isPlayingSong = false;
  
  const playIcon = document.getElementById('svg-play');
  const playText = document.getElementById('txt-play');
  
  if (playText) playText.textContent = "Listen";
  if (playIcon) {
    playIcon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"/>`;
  }
}

// --- 5. UI Rendering & Sync Helpers ---

/**
 * Populates and injects the harmonica hole nodes into the DOM.
 */
function renderHarmonicaHoles() {
  const body = document.querySelector('.harmonica-body');
  body.innerHTML = '';
  
  for (let hole = 1; hole <= 12; hole++) {
    const holeEl = document.createElement('div');
    holeEl.className = 'harmonica-hole';
    holeEl.setAttribute('data-hole', hole);
    
    // Keyboard key overlay label
    let keyTip = hole.toString();
    if (hole === 10) keyTip = '0';
    if (hole === 11) keyTip = '-';
    if (hole === 12) keyTip = '=';
    
    holeEl.innerHTML = `
      <span class="keyboard-key">${keyTip}</span>
      <span class="hole-number">${hole}</span>
      <div class="hole-notes-container">
        <div class="hole-note blow-note">C4</div>
        <div class="hole-note draw-note">D4</div>
      </div>
    `;
    
    // Attach click events
    holeEl.addEventListener('click', () => {
      initAudio();
      submitAnswer(hole);
    });
    
    body.appendChild(holeEl);
  }
}

/**
 * Updates the note letters displayed in the visual harmonica holes.
 */
function updateHarmonicaLabels(spellingStyle) {
  const spelling = spellingStyle || currentGameState.lastSpellingStyle;
  
  for (let hole = 1; hole <= 12; hole++) {
    const holeEl = document.querySelector(`.harmonica-hole[data-hole="${hole}"]`);
    if (holeEl) {
      const blowNoteEl = holeEl.querySelector('.blow-note');
      const drawNoteEl = holeEl.querySelector('.draw-note');
      
      const blowMidi = getNoteForHole(hole, 'blow', currentGameState.slide);
      const drawMidi = getNoteForHole(hole, 'draw', currentGameState.slide);
      
      // Clean display name (removing octave digits like C4 -> C for harmonica face, or leaving it,
      // let's show octave digit to be explicit, e.g. C4 vs C5)
      blowNoteEl.textContent = getABCNotation(blowMidi, spelling).name;
      drawNoteEl.textContent = getABCNotation(drawMidi, spelling).name;
    }
  }
}

/**
 * Rerenders current statistics values.
 */
function updateStatsUI() {
  document.getElementById('stat-score').textContent = currentGameState.score;
  document.getElementById('stat-streak').textContent = currentGameState.streak;
  
  // Accuracy percentage
  const accuracy = currentGameState.totalAttempts > 0 
    ? Math.round((currentGameState.correctAnswers / currentGameState.totalAttempts) * 100)
    : 0;
  document.getElementById('stat-accuracy').textContent = `${accuracy}%`;
  
  // Average response speed
  const avgSpeed = currentGameState.correctAnswers > 0
    ? (currentGameState.speedSum / currentGameState.correctAnswers).toFixed(1)
    : "0.0";
  document.getElementById('stat-speed').textContent = `${avgSpeed}s`;
}

/**
 * Synchronizes breath UI toggles.
 */
function setBreathState(state) {
  currentGameState.breath = state;
  const assembly = document.getElementById('harmonica-assembly');
  const blowBtn = document.getElementById('btn-breath-blow');
  const drawBtn = document.getElementById('btn-breath-draw');
  
  if (state === 'blow') {
    assembly.classList.remove('draw-state');
    assembly.classList.add('blow-state');
    blowBtn.classList.add('active-blow');
    drawBtn.classList.remove('active-draw');
  } else {
    assembly.classList.remove('blow-state');
    assembly.classList.add('draw-state');
    blowBtn.classList.remove('active-blow');
    drawBtn.classList.add('active-draw');
  }
}

function toggleBreath() {
  const nextBreath = currentGameState.breath === 'blow' ? 'draw' : 'blow';
  setBreathState(nextBreath);
}

/**
 * Synchronizes slide button state and animation.
 */
function setSlideState(active) {
  if (currentGameState.slide === active) return;
  
  currentGameState.slide = active;
  const assembly = document.getElementById('harmonica-assembly');
  const switchEl = document.getElementById('slide-switch');
  const descEl = document.getElementById('slide-desc');
  
  if (active) {
    assembly.classList.add('slide-in');
    switchEl.classList.add('active');
    descEl.textContent = "Slide In (Raised 1 Semitone)";
  } else {
    assembly.classList.remove('slide-in');
    switchEl.classList.remove('active');
    descEl.textContent = "Slide Out (Natural Scale)";
  }
  
  // Update harmonica label values since slide modifies hole pitches
  updateHarmonicaLabels();
}

/**
 * Refreshes spelling state for the target note and updates staff.
 */
function handleSpellingConfigChange() {
  let spelling = currentSettings.spelling;
  if (spelling === 'random') {
    spelling = currentGameState.lastSpellingStyle;
  } else {
    currentGameState.lastSpellingStyle = spelling;
  }
  
  if (currentGameState.targetMidi) {
    const noteInfo = getABCNotation(currentGameState.targetMidi, spelling);
    currentGameState.targetAbc = noteInfo.abc;
    currentGameState.targetName = noteInfo.name;
    
    renderSheetMusic(noteInfo.abc);
    updateHarmonicaLabels(spelling);
  }
}

/**
 * Resets score sheet back to 0.
 */
function resetStats() {
  currentGameState.score = 0;
  currentGameState.totalAttempts = 0;
  currentGameState.streak = 0;
  currentGameState.correctAnswers = 0;
  currentGameState.speedSum = 0;
  updateStatsUI();
}

// --- 6. Event Listeners & Initialization ---

function initEventListeners() {
  // Mode Selection Toggles
  document.getElementById('btn-mode-quiz').addEventListener('click', () => {
    initAudio();
    switchMode('quiz');
  });
  document.getElementById('btn-mode-song').addEventListener('click', () => {
    initAudio();
    switchMode('song');
  });
  
  // Song selection dropdown change
  document.getElementById('select-song').addEventListener('change', () => {
    initAudio();
    loadActiveSong();
  });
  
  // Song playback button (Listen)
  document.getElementById('btn-song-play').addEventListener('click', () => {
    initAudio();
    toggleSongPlayback();
  });
  
  // Song reset button
  document.getElementById('btn-song-reset').addEventListener('click', () => {
    initAudio();
    resetSong();
  });
  
  // Tempo BPM slider input
  const tempoSlider = document.getElementById('input-tempo');
  const tempoLabel = document.getElementById('lbl-tempo');
  if (tempoSlider && tempoLabel) {
    tempoSlider.addEventListener('input', (e) => {
      playbackTempoBpm = parseInt(e.target.value);
      tempoLabel.textContent = playbackTempoBpm;
      
      // If currently playing, restart interval with new tempo
      if (isPlayingSong) {
        stopSongPlayback();
        toggleSongPlayback();
      }
    });
  }
  
  // Custom Song Load Button
  document.getElementById('btn-load-custom').addEventListener('click', () => {
    initAudio();
    const customAbc = document.getElementById('txt-custom-abc').value.trim();
    if (customAbc) {
      loadCustomSong(customAbc);
    } else {
      alert("Please paste some notes first!");
    }
  });

  // Reset stats button
  document.getElementById('btn-reset-stats').addEventListener('click', () => {
    initAudio();
    resetStats();
  });
  
  // Play note sound button
  document.getElementById('btn-play-note').addEventListener('click', () => {
    initAudio();
    playTargetSound();
  });
  
  // Skip note button
  document.getElementById('btn-skip').addEventListener('click', () => {
    initAudio();
    if (currentGameState.isTransitioning) return;
    nextQuestion();
  });
  
  // Breath controls
  document.getElementById('btn-breath-blow').addEventListener('click', () => {
    initAudio();
    setBreathState('blow');
  });
  document.getElementById('btn-breath-draw').addEventListener('click', () => {
    initAudio();
    setBreathState('draw');
  });
  
  // Slide button container toggle
  document.getElementById('slide-switch').addEventListener('click', () => {
    initAudio();
    setSlideState(!currentGameState.slide);
  });
  
  // Visual slide button on the harmonica body itself
  const visualSlide = document.getElementById('harmonica-slide-visual');
  if (visualSlide) {
    visualSlide.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent clicks from leaking to underlying holes
      initAudio();
      setSlideState(!currentGameState.slide);
    });
  }
  
  // Range dropdown
  document.getElementById('select-range').addEventListener('change', (e) => {
    currentSettings.range = e.target.value;
    nextQuestion();
  });
  
  // Spelling dropdown
  document.getElementById('select-spelling').addEventListener('change', (e) => {
    currentSettings.spelling = e.target.value;
    handleSpellingConfigChange();
  });
  
  // Accidentals checkbox
  document.getElementById('chk-accidentals').addEventListener('change', (e) => {
    currentSettings.accidentals = e.target.checked;
    nextQuestion();
  });
  
  // Audio toggle
  document.getElementById('chk-sound').addEventListener('change', (e) => {
    currentSettings.sound = e.target.checked;
    if (currentSettings.sound) {
      initAudio();
    }
  });
  
  // Labels toggle
  const labelCheckbox = document.getElementById('chk-labels');
  const controllerCard = document.getElementById('harmonica-controller');
  
  labelCheckbox.addEventListener('change', (e) => {
    currentSettings.showLabels = e.target.checked;
    if (currentSettings.showLabels) {
      controllerCard.classList.add('show-note-names');
    } else {
      controllerCard.classList.remove('show-note-names');
    }
  });
  
  // Initialize visibility matching starting config
  if (currentSettings.showLabels) {
    controllerCard.classList.add('show-note-names');
  }
  
  // --- Keyboard Shortcuts Listeners ---
  
  window.addEventListener('keydown', (e) => {
    // Ignore key presses if game is transitioning or keys are combined with Ctrl/Cmd
    if (currentGameState.isTransitioning || e.ctrlKey || e.metaKey) return;
    
    const key = e.key.toLowerCase();
    
    // Spacebar -> Toggle Breath direction
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      toggleBreath();
      return;
    }
    
    // Shift -> Press slide button in
    if (e.key === 'Shift') {
      e.preventDefault();
      setSlideState(true);
      return;
    }
    
    // S key -> Toggle slide button (sticky mode)
    if (key === 's') {
      e.preventDefault();
      setSlideState(!currentGameState.slide);
      return;
    }
    
    // K or P -> Replay current target sound
    if (key === 'k' || key === 'p') {
      e.preventDefault();
      playTargetSound();
      return;
    }
    
    // Numerical key shortcuts for holes 1-12
    let hole = null;
    if (key >= '1' && key <= '9') {
      hole = parseInt(key);
    } else if (key === '0') {
      hole = 10;
    } else if (key === '-') {
      hole = 11;
    } else if (key === '=') {
      hole = 12;
    }
    
    if (hole !== null) {
      e.preventDefault();
      initAudio();
      
      // Flash the selected hole visually to confirm keyboard capture
      const holeEl = document.querySelector(`.harmonica-hole[data-hole="${hole}"]`);
      if (holeEl) {
        holeEl.classList.add('active-playing');
        setTimeout(() => holeEl.classList.remove('active-playing'), 120);
      }
      
      submitAnswer(hole);
    }
  });
  
  window.addEventListener('keyup', (e) => {
    // Shift release -> Slide out
    if (e.key === 'Shift') {
      e.preventDefault();
      setSlideState(false);
    }
  });
  
  // Dismiss feedback overlay on click to skip transition wait time
  document.getElementById('feedback-overlay').addEventListener('click', () => {
    if (currentGameState.isTransitioning) {
      if (currentMode === 'song') return; // Handled locally in showSongCompletionMessage
      // Clean transition lock early and load next question
      currentGameState.isTransitioning = false;
      nextQuestion();
    }
  });
}

// App Initialization
window.addEventListener('DOMContentLoaded', () => {
  renderHarmonicaHoles();
  initEventListeners();
  nextQuestion();
  updateStatsUI();
});
