/**
 * MODERN SOUTH INDIAN WEDDING INVITATION - NEXT-GEN INTERACTION & MOBILE ENGINE
 * Couple: Murali Krishna & Ramya B S
 * Features:
 * - Photorealistic South Indian Temple Mandap 3D Parallax Layer
 * - Mobile Touch-Driven Wind Ripples & Gyroscope 3D Parallax Tilt
 * - Dynamic Cursor Spotlight & Interactive Flower Shower Button
 * - Interactive Cutout Blessing Aura & Tap Bursts
 * - 60fps Canvas with Jasmine, Marigold, Rose Petals & Golden Akshata
 * - Discrete Audio Player with Carnatic Veena Harmonic Synth Fallback
 * - Wedding Day Photos Modal with Live Countdown
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. CONFIGURATION & CONSTANTS
  // =========================================================================
  const WEDDING_DATE = new Date('2026-11-15T10:15:00+05:30'); // 15 Nov 2026 10:15 AM IST


  // =========================================================================
  // 2. DYNAMIC CURSOR 3D SPOTLIGHT (DESKTOP)
  // =========================================================================
  const spotlight = document.getElementById('cursor-spotlight');
  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  let spotX = pointerX;
  let spotY = pointerY;

  window.addEventListener('mousemove', (e) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
  }, { passive: true });

  function updateSpotlight() {
    if (spotlight && window.innerWidth > 768) {
      spotX += (pointerX - spotX) * 0.12;
      spotY += (pointerY - spotY) * 0.12;
      spotlight.style.transform = `translate3d(${spotX}px, ${spotY}px, 0)`;
    }
    requestAnimationFrame(updateSpotlight);
  }
  requestAnimationFrame(updateSpotlight);

  // =========================================================================
  // 3. FALLING FLOWER PETALS & GOLDEN STARDUST (MOBILE TOUCH & DESKTOP 60FPS)
  // =========================================================================
  const canvas = document.getElementById('flower-canvas');
  let burstFlowersGlobal = null;

  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const PETAL_TYPES = ['jasmine', 'marigold', 'rose', 'akshata'];
    const petals = [];
    // Reduced petal count to ensure text and details are crystal-clear to read
    const MAX_PETALS = window.innerWidth < 768 ? 8 : 14;

    class Petal {
      constructor(x, y, isBurst = false) {
        this.reset(x, y, isBurst);
      }

      reset(x, y, isBurst = false) {
        this.type = PETAL_TYPES[Math.floor(Math.random() * PETAL_TYPES.length)];
        this.x = x !== undefined ? x : Math.random() * width;
        this.y = y !== undefined ? y : -25 - Math.random() * 40;

        if (this.type === 'jasmine') {
          this.size = Math.random() * 7 + 7;
          this.color = '#FFFFFF';
          this.centerColor = '#FFD000';
        } else if (this.type === 'marigold') {
          this.size = Math.random() * 9 + 8;
          this.color = Math.random() > 0.4 ? '#FFB703' : '#FB8500';
        } else if (this.type === 'rose') {
          this.size = Math.random() * 10 + 8;
          this.color = Math.random() > 0.5 ? '#E63946' : '#C1121F';
        } else {
          // Shimmering Golden Akshata Particle
          this.size = Math.random() * 3.5 + 2;
          this.color = '#FFE885';
        }

        if (isBurst) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 5.5 + 2.0;
          this.vx = Math.cos(angle) * speed;
          this.vy = Math.sin(angle) * speed - 2.5;
        } else {
          this.vx = (Math.random() - 0.5) * 0.9;
          this.vy = this.type === 'akshata' ? Math.random() * 1.3 + 0.9 : Math.random() * 1.0 + 0.7;
        }

        this.rotation = Math.random() * 360;
        this.rotationSpeed = (Math.random() - 0.5) * 1.8;
        this.oscillation = Math.random() * Math.PI * 2;
        this.oscillationSpeed = Math.random() * 0.02 + 0.008;
        this.oscillationAmp = Math.random() * 1.2 + 0.5;
        // Soft translucent opacity so text is never obstructed
        this.opacity = Math.random() * 0.25 + 0.35;
        this.scaleY = Math.random() * 0.5 + 0.5;
      }

      update() {
        this.oscillation += this.oscillationSpeed;
        this.x += this.vx + Math.sin(this.oscillation) * this.oscillationAmp;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;
        this.scaleY = Math.sin(this.oscillation * 2) * 0.4 + 0.6;

        // Interactive wind repulsion from pointer / touch point
        const dx = this.x - pointerX;
        const dy = this.y - pointerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const repelRadius = window.innerWidth < 768 ? 120 : 100;
        if (dist < repelRadius) {
          const force = (repelRadius - dist) / repelRadius;
          this.x += (dx / dist) * force * 4.0;
          this.y += (dy / dist) * force * 4.0;
        }

        if (this.y > height + 35) {
          this.reset(Math.random() * width, -20);
        }
        if (this.x < -30) this.x = width + 20;
        if (this.x > width + 30) this.x = -20;
      }

      draw(c) {
        c.save();
        c.translate(this.x, this.y);
        c.rotate((this.rotation * Math.PI) / 180);
        c.scale(1, this.scaleY);
        c.globalAlpha = this.opacity;

        if (this.type === 'jasmine') {
          c.fillStyle = this.color;
          c.beginPath();
          for (let i = 0; i < 4; i++) {
            c.rotate(Math.PI / 2);
            c.ellipse(0, -this.size * 0.6, this.size * 0.3, this.size * 0.6, 0, 0, Math.PI * 2);
          }
          c.fill();
          c.fillStyle = this.centerColor;
          c.beginPath();
          c.arc(0, 0, this.size * 0.2, 0, Math.PI * 2);
          c.fill();
        } else if (this.type === 'marigold') {
          c.fillStyle = this.color;
          c.beginPath();
          c.moveTo(0, 0);
          c.quadraticCurveTo(this.size * 0.6, -this.size * 0.4, this.size * 0.5, -this.size);
          c.quadraticCurveTo(0, -this.size * 1.2, -this.size * 0.5, -this.size);
          c.quadraticCurveTo(-this.size * 0.6, -this.size * 0.4, 0, 0);
          c.closePath();
          c.fill();
        } else if (this.type === 'rose') {
          c.fillStyle = this.color;
          c.beginPath();
          c.moveTo(0, 0);
          c.bezierCurveTo(this.size * 0.8, -this.size * 0.3, this.size * 0.8, -this.size, 0, -this.size * 1.2);
          c.bezierCurveTo(-this.size * 0.8, -this.size, -this.size * 0.8, -this.size * 0.3, 0, 0);
          c.closePath();
          c.fill();
        } else {
          c.fillStyle = this.color;
          c.shadowColor = '#FFD700';
          c.shadowBlur = 6;
          c.beginPath();
          c.ellipse(0, 0, this.size * 0.6, this.size * 1.2, Math.PI / 4, 0, Math.PI * 2);
          c.fill();
        }

        c.restore();
      }
    }

    // Initialize petals
    for (let i = 0; i < MAX_PETALS; i++) {
      petals.push(new Petal(Math.random() * width, Math.random() * height));
    }

    function animatePetals() {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < petals.length; i++) {
        petals[i].update();
        petals[i].draw(ctx);
      }
      requestAnimationFrame(animatePetals);
    }
    requestAnimationFrame(animatePetals);

    // Global burst function
    burstFlowersGlobal = function (x, y, count = 16) {
      for (let i = 0; i < count; i++) {
        petals.push(new Petal(x, y, true));
        if (petals.length > MAX_PETALS + 35) {
          petals.shift();
        }
      }
      if ('vibrate' in navigator) {
        try { navigator.vibrate(18); } catch (e) { }
      }
    };

    // Desktop Click Burst
    window.addEventListener('click', (e) => {
      if (e.target.closest('button, a, input, textarea, .celebration-card')) return;
      burstFlowersGlobal(e.clientX, e.clientY, 14);
    });

    // Mobile Touch Dragging Wind Waves & Touch Tap Burst
    window.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        pointerX = e.touches[0].clientX;
        pointerY = e.touches[0].clientY;
        if (!e.target.closest('button, a, input, textarea, .celebration-card')) {
          burstFlowersGlobal(pointerX, pointerY, 10);
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) {
        pointerX = e.touches[0].clientX;
        pointerY = e.touches[0].clientY;
      }
    }, { passive: true });
  }

  // =========================================================================
  // 4. INTERACTIVE COUPLE STAGE BLESSING BURSTS
  // =========================================================================
  // Interactive Cutout Blessing Aura & Tap Reaction
  const groomStage = document.getElementById('groom-interactive-stage');
  const brideStage = document.getElementById('bride-interactive-stage');

  function attachCoupleReaction(stage) {
    if (!stage) return;
    stage.addEventListener('click', (e) => {
      const rect = stage.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height * 0.4;
      if (burstFlowersGlobal) {
        burstFlowersGlobal(x, y, 18);
      }
    });
  }

  attachCoupleReaction(groomStage);
  attachCoupleReaction(brideStage);

  // =========================================================================
  // 5. NEXT-GEN 3D PARALLAX TILT & SPECULAR SHEEN (DESKTOP & TOUCH MOBILE)
  // =========================================================================
  const tiltElements = document.querySelectorAll('.parallax-tilt');

  tiltElements.forEach((el) => {
    const factor = parseFloat(el.getAttribute('data-tilt-factor')) || 10;

    function handleTilt(x, y) {
      if (window.innerWidth <= 768) return;
      const rect = el.getBoundingClientRect();
      const posX = x - rect.left;
      const posY = y - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((posY - centerY) / centerY) * -factor;
      const rotateY = ((posX - centerX) / centerX) * factor;

      const mouseXPercent = ((posX / rect.width) * 100).toFixed(1) + '%';
      const mouseYPercent = ((posY / rect.height) * 100).toFixed(1) + '%';
      el.style.setProperty('--mouse-x', mouseXPercent);
      el.style.setProperty('--mouse-y', mouseYPercent);

      el.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
    }

    function resetTilt() {
      el.style.transform = '';
      el.style.removeProperty('--mouse-x');
      el.style.removeProperty('--mouse-y');
    }

    el.addEventListener('mousemove', (e) => handleTilt(e.clientX, e.clientY));
    el.addEventListener('mouseleave', resetTilt);
  });

  // =========================================================================
  // 6. TEMPLE MANDAP & BACKGROUND MULTI-PLANE PARALLAX
  // =========================================================================
  const parallaxLayers = document.querySelectorAll('[data-parallax-depth]');

  // Desktop Mouse Parallax
  window.addEventListener('mousemove', (e) => {
    if (window.innerWidth <= 768) return;
    const normX = (e.clientX / window.innerWidth - 0.5) * 2;
    const normY = (e.clientY / window.innerHeight - 0.5) * 2;

    parallaxLayers.forEach((layer) => {
      const depth = parseFloat(layer.getAttribute('data-parallax-depth')) || 0.1;
      const moveX = normX * depth * 60;
      const moveY = normY * depth * 60;
      layer.style.transform = `translate3d(${moveX.toFixed(1)}px, ${moveY.toFixed(1)}px, 0)`;
    });
  }, { passive: true });

  // Mobile Device Orientation (Gyroscope Background Ambience Only - Keeps Text Razor Sharp)
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma !== null && e.beta !== null) {
        const tiltX = Math.max(-14, Math.min(14, e.gamma / 2.5));
        const tiltY = Math.max(-14, Math.min(14, (e.beta - 45) / 2.5));

        parallaxLayers.forEach((layer) => {
          const depth = parseFloat(layer.getAttribute('data-parallax-depth')) || 0.1;
          const moveX = tiltX * depth * 4.0;
          const moveY = tiltY * depth * 4.0;
          layer.style.transform = `translate3d(${moveX.toFixed(1)}px, ${moveY.toFixed(1)}px, 0)`;
        });
      }
    }, { passive: true });
  }

  // =========================================================================
  // 6. TEMPLE MANDAP BACKGROUND SEAMLESS SCROLL PARALLAX (ZERO STRIPES / GAPS)
  // =========================================================================
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const templeImg = document.querySelector('.temple-bg-image');
    if (templeImg) {
      // Clamped subtle pan so image boundaries never become exposed
      const yOffset = Math.min(scrolled * 0.04, 35);
      templeImg.style.transform = `scale(1.02) translate3d(0, ${-yOffset}px, 0)`;
    }
  }, { passive: true });

  // =========================================================================
  // 7. TRADITIONAL WEDDING MUSIC ENGINE & VEENA / NADASWARAM SYNTH
  // =========================================================================
  const audioBtn = document.getElementById('audio-toggle-btn');
  const audioElement = document.getElementById('wedding-audio');
  let audioContext = null;
  let synthDroneActive = false;
  let synthInterval = null;
  let synthNodes = [];

  function getOrCreateAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioContext) audioContext = new AudioCtx();
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }

  // Resonant Auspicious Temple Bell Chime (Ghantha)
  function playTempleBellChime() {
    try {
      const ctx = getOrCreateAudioContext();
      if (!ctx) return;

      const bellGain = ctx.createGain();
      bellGain.gain.setValueAtTime(0.08, ctx.currentTime);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.0);
      bellGain.connect(ctx.destination);

      [587.33, 880, 1174.66, 1760].forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.connect(bellGain);
        osc.start();
        osc.stop(ctx.currentTime + 3.0);
      });
    } catch (e) {
      console.warn('Temple bell chime error:', e);
    }
  }

  function createCarnaticVeenaDrone() {
    try {
      const ctx = getOrCreateAudioContext();
      if (!ctx) return;
      if (synthDroneActive) return;

      const baseFreq = 146.83; // D3 Sa
      const freqs = [baseFreq, baseFreq * 1.5, baseFreq * 2, baseFreq * 2.5];

      synthNodes = [];
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.07, ctx.currentTime);
      masterGain.connect(ctx.destination);

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0.035 / (idx + 1), ctx.currentTime);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start();

        synthNodes.push({ osc, gain });
      });

      // Melodic Swaras Plucked in Kalyani Raga
      const swaras = [baseFreq * 1.125, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 1.875, baseFreq * 2];
      synthInterval = setInterval(() => {
        if (!synthDroneActive || !audioContext) return;
        const noteFreq = swaras[Math.floor(Math.random() * swaras.length)];
        const pluck = audioContext.createOscillator();
        const pluckGain = audioContext.createGain();
        pluck.type = 'triangle';
        pluck.frequency.setValueAtTime(noteFreq, audioContext.currentTime);

        pluckGain.gain.setValueAtTime(0.055, audioContext.currentTime);
        pluckGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1.8);

        pluck.connect(pluckGain);
        pluckGain.connect(audioContext.destination);
        pluck.start();
        pluck.stop(audioContext.currentTime + 2.0);
      }, 2200);

      synthDroneActive = true;
    } catch (e) {
      console.warn('Audio synthesis fallback error:', e);
    }
  }

  function stopCarnaticSynth() {
    synthDroneActive = false;
    if (synthInterval) clearInterval(synthInterval);
    synthNodes.forEach((n) => {
      try {
        n.osc.stop();
        n.osc.disconnect();
      } catch (err) { }
    });
    synthNodes = [];
  }

  function playWeddingMusic() {
    getOrCreateAudioContext();
    if (audioElement) {
      if (!audioElement.src || audioElement.src === '') {
        audioElement.src = 'music.mp3';
      }
      const playPromise = audioElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (audioBtn) audioBtn.classList.add('playing');
          })
          .catch((err) => {
            console.log('Playback waiting for interaction:', err);
            playTempleBellChime();
          });
      } else {
        if (audioBtn) audioBtn.classList.add('playing');
      }
    } else {
      playTempleBellChime();
      createCarnaticVeenaDrone();
      if (audioBtn) audioBtn.classList.add('playing');
    }
  }

  function stopWeddingMusic() {
    if (audioElement && !audioElement.paused) {
      audioElement.pause();
    }
    if (synthDroneActive) {
      stopCarnaticSynth();
    }
    if (audioBtn) audioBtn.classList.remove('playing');
  }

  if (audioElement) {
    audioElement.addEventListener('play', () => {
      if (audioBtn) audioBtn.classList.add('playing');
    });
    audioElement.addEventListener('pause', () => {
      if (audioBtn) audioBtn.classList.remove('playing');
    });
  }

  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      if ('vibrate' in navigator) {
        try { navigator.vibrate(25); } catch (e) { }
      }

      if ((audioElement && !audioElement.paused) || synthDroneActive) {
        stopWeddingMusic();
      } else {
        playWeddingMusic();
      }
    });
  }

  // =========================================================================
  // 8. ROYAL 3D UNVEILING COVER CONTROLLER & ROTARY KNOB ENGINE
  // =========================================================================
  const weddingCover = document.getElementById('wedding-cover');
  const coverKnobBtn = document.getElementById('cover-knob-btn');
  const knobActionLabel = document.querySelector('.knob-action-label .knob-label-text');
  let coverOpened = false;

  function turnKnobAndOpen(e) {
    if (coverOpened || !weddingCover) return;
    coverOpened = true;

    // Haptic vibration feedback
    if ('vibrate' in navigator) {
      try { navigator.vibrate([35, 40, 70]); } catch (err) { }
    }

    // 1. Trigger realistic rotary knob mechanical turn animation
    if (coverKnobBtn) {
      coverKnobBtn.classList.add('turning');
    }

    if (knobActionLabel) {
      knobActionLabel.textContent = 'Opening...';
    }

    // 2. Play resonant temple bell chime immediately upon turning
    playTempleBellChime();

    // 3. Start auspicious Shenai / Veena wedding music
    playWeddingMusic();

    // 4. Auspicious flower burst emanating outwards from the knob position (subtle, non-obtrusive)
    let clickX = window.innerWidth / 2;
    let clickY = window.innerHeight * 0.72;
    if (coverKnobBtn) {
      const rect = coverKnobBtn.getBoundingClientRect();
      clickX = rect.left + rect.width / 2;
      clickY = rect.top + rect.height / 2;
    } else if (e && e.clientX) {
      clickX = e.clientX;
      clickY = e.clientY;
    }

    if (burstFlowersGlobal) {
      burstFlowersGlobal(clickX, clickY, 10);
      setTimeout(() => {
        burstFlowersGlobal(window.innerWidth * 0.35, window.innerHeight * 0.38, 6);
        burstFlowersGlobal(window.innerWidth * 0.65, window.innerHeight * 0.38, 6);
      }, 300);
    }

    // 5. After knob finishes its mechanical turn (400ms), swing open the 3D gates
    setTimeout(() => {
      weddingCover.classList.add('opening');
    }, 400);

    // 6. Complete transition, hide cover, and trigger entrance animations AFTER cover is open
    setTimeout(() => {
      weddingCover.classList.add('unfolded');
      weddingCover.style.display = 'none';

      // Trigger animations AFTER opening the cover page!
      triggerFadeUpEntrance();
    }, 1250);
  }

  // Interactive Touch & Mouse Drag to Turn Knob
  if (coverKnobBtn) {
    let isTrackingKnob = false;
    let knobCenter = { x: 0, y: 0 };
    let initialAngle = 0;

    function getAngle(clientX, clientY) {
      return Math.atan2(clientY - knobCenter.y, clientX - knobCenter.x) * (180 / Math.PI);
    }

    coverKnobBtn.addEventListener('mousedown', (e) => {
      if (coverOpened) return;
      isTrackingKnob = true;
      const rect = coverKnobBtn.getBoundingClientRect();
      knobCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      initialAngle = getAngle(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (!isTrackingKnob || coverOpened) return;
      const currentAngle = getAngle(e.clientX, e.clientY);
      let diff = currentAngle - initialAngle;
      if (diff < -180) diff += 360;
      if (diff > 180) diff -= 360;

      // Turning clockwise by > 30 degrees triggers unlock
      if (diff > 30) {
        isTrackingKnob = false;
        turnKnobAndOpen(e);
      }
    });

    window.addEventListener('mouseup', () => {
      isTrackingKnob = false;
    });

    // Mobile Touch Drag Support
    coverKnobBtn.addEventListener('touchstart', (e) => {
      if (coverOpened || !e.touches || !e.touches[0]) return;
      isTrackingKnob = true;
      const rect = coverKnobBtn.getBoundingClientRect();
      knobCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      initialAngle = getAngle(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!isTrackingKnob || coverOpened || !e.touches || !e.touches[0]) return;
      const currentAngle = getAngle(e.touches[0].clientX, e.touches[0].clientY);
      let diff = currentAngle - initialAngle;
      if (diff < -180) diff += 360;
      if (diff > 180) diff -= 360;

      if (diff > 25) {
        isTrackingKnob = false;
        turnKnobAndOpen(e.touches[0]);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      isTrackingKnob = false;
    });

    // Direct Click / Tap on Knob
    coverKnobBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      turnKnobAndOpen(e);
    });

    // Keyboard Accessibility (Enter or Space)
    coverKnobBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        turnKnobAndOpen(e);
      }
    });
  }

  // Clicking anywhere on the cover also triggers the turn-and-open sequence
  if (weddingCover) {
    weddingCover.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      turnKnobAndOpen(e);
    });
  }

  // =========================================================================
  // 8. VIEW WEDDING PHOTO BUTTON & MODAL
  // =========================================================================
  const viewPhotoBtn = document.getElementById('view-photo-btn');
  const photoModal = document.getElementById('photo-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalDismissBtn = document.getElementById('modal-dismiss-btn');
  const modalBackdrop = document.getElementById('modal-backdrop');

  function updateCountdown() {
    const now = new Date().getTime();
    const diff = WEDDING_DATE.getTime() - now;

    if (diff <= 0) {
      const cdDays = document.getElementById('cd-days');
      if (cdDays) cdDays.textContent = '00';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    const elDays = document.getElementById('cd-days');
    const elHours = document.getElementById('cd-hours');
    const elMins = document.getElementById('cd-mins');
    const elSecs = document.getElementById('cd-secs');

    if (elDays) elDays.textContent = String(days).padStart(2, '0');
    if (elHours) elHours.textContent = String(hours).padStart(2, '0');
    if (elMins) elMins.textContent = String(mins).padStart(2, '0');
    if (elSecs) elSecs.textContent = String(secs).padStart(2, '0');
  }

  setInterval(updateCountdown, 1000);
  updateCountdown();

  function openPhotoModal() {
    if (!photoModal) return;
    photoModal.classList.add('active');
    photoModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    updateCountdown();
  }

  function closePhotoModal() {
    if (!photoModal) return;
    photoModal.classList.remove('active');
    photoModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (viewPhotoBtn) {
    viewPhotoBtn.addEventListener('click', openPhotoModal);
    viewPhotoBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPhotoModal();
      }
    });
  }
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closePhotoModal);
  if (modalDismissBtn) modalDismissBtn.addEventListener('click', closePhotoModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closePhotoModal);

  // =========================================================================
  // 9. RECENT FAMILY CELEBRATIONS GALLERY CARDS
  // =========================================================================
  const celebrationCards = document.querySelectorAll('.celebration-card');

  celebrationCards.forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a') || e.target.closest('button')) return;
      const link = card.querySelector('.celebration-action-btn');
      if (link && link.href) {
        window.location.href = link.href;
      }
    });
  });

  // Global ESC key listener to close modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePhotoModal();
    }
  });

  // =========================================================================
  // 10. STAGGERED FADE-UP ENTRANCE & SCROLL REVEAL CONTROLLER
  // =========================================================================
  function triggerFadeUpEntrance() {
    document.body.classList.add('cover-unveiled');

    const isMobile = window.innerWidth <= 768;

    // Responsive initial cascade: On mobile, only elements in the top initial viewport stagger immediately,
    // so cards below the fold can fade in dynamically as the user scrolls to them!
    const heroElements = isMobile
      ? [
        { sel: '.auspicious-title-badge', delay: 40 },
        { sel: '.main-invite-title', delay: 140 },
        { sel: '.auspicious-header-section .kolam-line-divider', delay: 220 },
        { sel: '.wedding-subtitle', delay: 300 },
        { sel: '.groom-stage', delay: 440 }
      ]
      : [
        { sel: '.auspicious-title-badge', delay: 40 },
        { sel: '.main-invite-title', delay: 140 },
        { sel: '.auspicious-header-section .kolam-line-divider', delay: 220 },
        { sel: '.wedding-subtitle', delay: 300 },
        { sel: '.groom-stage', delay: 420 },
        { sel: '.center-weds-emblem', delay: 520 },
        { sel: '.bride-stage', delay: 620 },
        { sel: '.details-cards-grid .detail-card:nth-child(1)', delay: 720 },
        { sel: '.details-cards-grid .detail-card:nth-child(2)', delay: 820 },
        { sel: '.details-cards-grid .detail-card:nth-child(3)', delay: 920 }
      ];

    heroElements.forEach((item) => {
      const el = document.querySelector(item.sel);
      if (el) {
        setTimeout(() => {
          el.classList.add('is-revealed');
          setTimeout(() => {
            el.classList.add('fade-up-done');
          }, 900);
        }, item.delay);
      }
    });

    // Initialize IntersectionObserver for ALL other elements so that on mobile or desktop,
    // EVERY component (WEDS emblem, Bride, Details cards, Map, Gallery, Inviters)
    // smoothly fades in right as it scrolls into view!
    initScrollReveal();
  }

  function initScrollReveal() {
    const scrollItems = document.querySelectorAll('.fade-up-item:not(.is-revealed)');
    if (!scrollItems.length) return;

    if (!('IntersectionObserver' in window)) {
      scrollItems.forEach((el) => {
        el.classList.add('is-revealed', 'fade-up-done');
      });
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          el.classList.add('is-revealed');
          setTimeout(() => {
            el.classList.add('fade-up-done');
          }, 850);
          obs.unobserve(el);
        }
      });
    }, {
      root: null,
      rootMargin: '0px 0px -15px 0px',
      threshold: 0.06
    });

    scrollItems.forEach((el) => observer.observe(el));
  }

  // Graceful fallback: If cover is removed or bypassed, reveal everything immediately
  if (!weddingCover || weddingCover.style.display === 'none') {
    document.body.classList.add('cover-unveiled');
    document.querySelectorAll('.fade-up-item').forEach((el) => {
      el.classList.add('is-revealed', 'fade-up-done');
    });
  }

})();
