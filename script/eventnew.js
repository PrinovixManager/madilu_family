// =====================================================
// EVENT FACE MATCH - FULL MERGED VERSION
// =====================================================

// ==========================================
// DATA HOLDERS
// ==========================================
let masterMeta = {};
let photoEntries = [];
let photoRepresentatives = [];
let allFaceList = [];

let CURRENT_THRESHOLD = 0.35;

let fastFrameReady = false;
let accurateFrameReady = false;




// ==========================================
// DOM
// ==========================================
const loader = document.getElementById("loader");
const loaderText = document.getElementById("loaderText");
const results = document.getElementById("results");
const uploadBtn = document.getElementById("floatingUploadBtn");
const showAllBtn = document.getElementById("showAllBtn");

const galleryInput = document.getElementById("galleryInput");

const modal = document.getElementById("imageModal");
const modalImg = document.getElementById("modalImage");

const layoutBtn = document.getElementById("layoutToggleBtn");

const debugPanel = document.getElementById("debugPanel");
const debugToggleBtn = document.getElementById("debugToggleBtn");
const eventTitleEl = document.getElementById("eventTitle");

const shareBtn = document.getElementById("shareBtn");

const thresholdSlider = document.getElementById("thresholdSlider");
const thresholdPercentText = document.getElementById("thresholdPercent");
const ENVIRONMENT = "production";

// ==========================================
// EVENT PARAM
// ==========================================
const params = new URLSearchParams(window.location.search);
const eventName = params.get("event");

if (!eventName) {
  showScreenMessage("Event not specified");
  debugLog("Event not specified")
  throw new Error("Event missing");
}

document.getElementById("eventTitle").innerText =
  `${eventName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}`;


// ==========================================
// DEBUG MODE URL
// ==========================================
let DEBUG_MODE = new URLSearchParams(window.location.search).get("debug") === "true";


// ==========================================
// R2 PUBLIC URLS (DOMAIN BASED)
// ==========================================
//const domain = window.location.hostname;
const domain = "prinopix.com";

const BASE_URL = `https://cdn.${domain}`;


const MASTER_BIN_URL = `${BASE_URL}/${ENVIRONMENT}/photo_hosting/${eventName}/master_bin/master.bin`;

const MASTER_JSON_URL = `${BASE_URL}/${ENVIRONMENT}/photo_hosting/${eventName}/master_json/master.json`;

const PHOTOGRAPHER_JSON_URL = `${BASE_URL}/${ENVIRONMENT}/photo_hosting/${eventName}/photographer_info/photographer.json`;



// ==========================================
// HELPERS
// ==========================================
function l2normFloat32(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i];
  s = Math.sqrt(s) || 1e-8;
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = arr[i] / s;
  return out;
}

function decompressDescriptor(int8arr) {
  const out = new Float32Array(128);
  for (let i = 0; i < 128; i++) out[i] = int8arr[i] / 127.0;
  return out;
}

function decompressBox(int16arr) {
  return [int16arr[0], int16arr[1], int16arr[2], int16arr[3]];
}

function parseCompressedBin(arrayBuffer) {
  const dv = new DataView(arrayBuffer);
  let offset = 0;
  const faceCount = dv.getUint8(offset++);
  const faces = [];

  for (let f = 0; f < faceCount; f++) {
    const d128 = new Int8Array(128);
    for (let i = 0; i < 128; i++) d128[i] = dv.getInt8(offset++);

    const b4 = new Int16Array(4);
    for (let i = 0; i < 4; i++) {
      b4[i] = dv.getInt16(offset, true);
      offset += 2;
    }

    faces.push({
      descriptor: decompressDescriptor(d128),
      box: decompressBox(b4)
    });
  }
  return faces;
}


// ==========================================
// IFRAME FACE PROCESSING
// ==========================================
async function processImageInIframe(file, mode = "fast") {
  const iframe = mode === "fast"
    ? document.getElementById("fastFrame")
    : document.getElementById("accurateFrame");

  if (!iframe) {
    debugLog("Iframe element missing")
    throw new Error("Iframe element missing");
  }

  debugLog(`⚙️ Photo Process Mode : ${mode}`)

  // WAIT UNTIL IFRAME IS ACTUALLY READY
  await waitForIframe(mode);

  const imageData = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const requestId = "req_" + Date.now();

  return new Promise((resolve, reject) => {

    function handler(e) {
      if (e.data?.id === requestId) {
        window.removeEventListener("message", handler);
        resolve(e.data.payload);
      }
    }

    window.addEventListener("message", handler);

    iframe.contentWindow.postMessage({
      id: requestId,
      imageData
    }, "*");
  });
}

function waitForIframe(mode, timeout = 200000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      if (
        (mode === "fast" && fastFrameReady) ||
        (mode === "accurate" && accurateFrameReady)
      ) {
        resolve();
      } else if (Date.now() - start > timeout) {
        reject(new Error("Iframe load timeout"));
      } else {
        requestAnimationFrame(check);
      }
    };

    check();
  });
}


// ==========================================
// LOAD MASTER.JSON
// ==========================================
async function loadMasterJson(jsonUrl) {
  const res = await fetch(jsonUrl);
  if (!res.ok) throw new Error("Failed to load master.json");
  masterMeta = await res.json();
}


// ==========================================
// LOAD MASTER.BIN
// ==========================================
async function loadMasterBinFromUrl(binUrl) {
  const res = await fetch(binUrl);
  if (!res.ok) throw new Error("Failed to load master.bin");

  const ab = await res.arrayBuffer();
  const dv = new DataView(ab);

  let offset = 0;
  const totalEntries = dv.getUint32(offset, true);
  offset += 4;

  photoEntries = [];
  photoRepresentatives = [];
  allFaceList = [];

  for (let e = 0; e < totalEntries; e++) {
    const nameLen = dv.getUint8(offset); offset++;
    const name = new TextDecoder().decode(new Uint8Array(ab, offset, nameLen));
    offset += nameLen;

    const binSize = dv.getUint32(offset, true); offset += 4;
    const binSlice = ab.slice(offset, offset + binSize);
    offset += binSize;

    const faces = parseCompressedBin(binSlice);
    photoEntries.push({ name, faces });

    if (!faces.length) {
      photoRepresentatives.push(null);
      continue;
    }

    const sum = new Float32Array(128);

    /*for (const f of faces) {
      const n = l2normFloat32(f.descriptor);
      for (let k = 0; k < 128; k++) sum[k] += n[k];

      allFaceList.push({
        photoIndex: e,
        descriptor: f.descriptor
      });
    }*/
    for (const f of faces) {
      const norm = l2normFloat32(f.descriptor);

      // ✅ store normalized version
      f.norm = norm;

      for (let k = 0; k < 128; k++) sum[k] += norm[k];

      allFaceList.push({
        photoIndex: e,
        descriptor: norm
      });
    }


    const avg = new Float32Array(128);
    for (let k = 0; k < 128; k++) avg[k] = sum[k] / faces.length;

    photoRepresentatives.push(l2normFloat32(avg));
  }
}


// ==========================================
// MATCH SELFIE TO MASTER 
// ==========================================
function matchSelfieToMaster(selfieDesc, threshold = 0.35) {
  if (!selfieDesc) return [];

  const s = l2normFloat32(selfieDesc);
  const matches = [];

  for (let i = 0; i < photoEntries.length; i++) {
    const faces = photoEntries[i].faces;
    if (!faces || !faces.length) continue;

    let bestDistance = Infinity;

    for (const f of faces) {

      // IMPORTANT: normalize ONCE at load time (see below)
      const dVec = f.norm || l2normFloat32(f.descriptor);

      let d = 0;
      for (let k = 0; k < 128; k++) {
        const diff = s[k] - dVec[k];
        d += diff * diff;
      }

      d = Math.sqrt(d);

      if (d < bestDistance) {
        bestDistance = d;
      }
    }

    if (bestDistance <= threshold) {
      matches.push({
        photoIndex: i,
        distance: bestDistance
      });
    }
  }

  return matches;
}


// ==========================================
// CURRENT GALLERY TRACKER & MODAL NAVIGATION
// ==========================================
let currentGalleryPhotos = [];
let currentPhotoIndex = 0;

// ==========================================
// SHOW ALL PHOTOS
// ==========================================
function showAllPhotos() {
  currentGalleryPhotos = [];
  results.innerHTML = "";
  for (const filename in masterMeta) {
    const data = masterMeta[filename];
    createPhotoCard(data.downloadURL, data.photoDriveId);
  }
  debugLog(`📸 Total Photo Count : ${Object.keys(masterMeta).length}`);
}

showAllBtn.addEventListener("click", () => {
  showAllPhotos();
  showDockHint("🖼️ Showing all event photos");
});



// ==========================================
// SHOW MATCHED PHOTOS 
// ==========================================
function showMatches(matches) {
  currentGalleryPhotos = [];
  results.innerHTML = "";

  if (!matches || matches.length === 0) {
    showScreenMessage("No matching photos found.");
    return;
  }

  matches.sort((a, b) => a.distance - b.distance);
  debugLog(`✨ Matched Photo Count : ${matches.length}`);


  for (const m of matches) {
    const idx = m.photoIndex;
    const name = photoEntries[idx]?.name;
    const meta = masterMeta[name];

    if (meta?.downloadURL) {
      createPhotoCard(meta.downloadURL, meta.photoDriveId);
    }
  }
}


// ==========================================
// DOWNLOAD
// ==========================================
function downloadFromDrive(id) {
  if (!id) {
    showPopup("Download not available");
    return;
  }
  //const link = `https://drive.usercontent.google.com/u/0/uc?id=${id}&export=download`;
  const link = `/download/${id}`;
  window.open(link, "_blank");
  debugLog(`GDrive Photo URL : https://drive.usercontent.google.com/u/0/uc?id=${id}&export=download`);
}


// ==========================================
// PROFESSIONAL GALLERY RENDER
// ==========================================
function createPhotoCard(url, driveId) {
  const photoIndex = currentGalleryPhotos.length;
  currentGalleryPhotos.push({ url, driveId });

  const card = document.createElement("div");
  card.className = "photo-card";

  const img = document.createElement("img");
  img.src = url;
  img.loading = "lazy";
  img.onclick = () => openImageModal(photoIndex);

  const downloadBtn = document.createElement("button");
  downloadBtn.className = "download-btn";
  downloadBtn.innerHTML = "Download";
  downloadBtn.onclick = (e) => {
    e.stopPropagation();
    downloadFromDrive(driveId);
  };

  card.appendChild(img);
  card.appendChild(downloadBtn);
  results.appendChild(card);
}


// ==========================================
// IMAGE MODAL & SWIPE NAVIGATION
// ==========================================
let isModalOpen = false;
let swipeHintTimer = null;
let idleSwipeTimer = null;

function triggerSwipeHint() {
  const hint = document.getElementById("swipeHint");
  const modal = document.getElementById("imageModal");
  if (!hint || !modal) return;
  if (modal.classList.contains("zoomed")) return;

  hint.classList.add("show");

  clearTimeout(swipeHintTimer);
  swipeHintTimer = setTimeout(() => {
    hint.classList.remove("show");
  }, 2800);
}

function hideSwipeHint() {
  const hint = document.getElementById("swipeHint");
  if (hint) {
    hint.classList.remove("show");
  }
  if (swipeHintTimer) {
    clearTimeout(swipeHintTimer);
  }
}

function startIdleSwipeTimer() {
  clearTimeout(idleSwipeTimer);
  if (isModalOpen && currentGalleryPhotos.length > 1) {
    idleSwipeTimer = setTimeout(() => {
      const modal = document.getElementById("imageModal");
      if (isModalOpen && modal && modal.style.display === "flex" && !modal.classList.contains("zoomed")) {
        triggerSwipeHint();
      }
      // Re-arm timer for subsequent 5s idle periods
      startIdleSwipeTimer();
    }, 5000);
  }
}

function stopIdleSwipeTimer() {
  clearTimeout(idleSwipeTimer);
}

function openImageModal(target) {
  const modal = document.getElementById("imageModal");
  const img = document.getElementById("modalImage");

  if (typeof target === "number") {
    currentPhotoIndex = target;
  } else {
    const idx = currentGalleryPhotos.findIndex(p => p.url === target);
    currentPhotoIndex = idx !== -1 ? idx : 0;
  }

  updateModalImage();
  modal.style.display = "flex";

  // ✅ Only push state if not already open
  if (!isModalOpen) {
    history.pushState({ modal: true }, "");
    isModalOpen = true;
  }

  img.style.touchAction = "manipulation";

  // Trigger auto-vanishing swipe hint & start 5s idle timer when gallery has multiple photos
  if (currentGalleryPhotos.length > 1) {
    triggerSwipeHint();
    startIdleSwipeTimer();
  }
}

function updateModalImage() {
  const modalImg = document.getElementById("modalImage");
  const modalCounter = document.getElementById("modalCounter");
  const prevBtn = document.getElementById("modalPrevBtn");
  const nextBtn = document.getElementById("modalNextBtn");
  const modalDownloadBtn = document.getElementById("modalDownloadBtn");

  if (!currentGalleryPhotos.length || currentPhotoIndex < 0 || currentPhotoIndex >= currentGalleryPhotos.length) return;

  const currentPhoto = currentGalleryPhotos[currentPhotoIndex];
  modalImg.src = currentPhoto.url;

  if (modalCounter) {
    modalCounter.innerText = `${currentPhotoIndex + 1} / ${currentGalleryPhotos.length}`;
  }

  if (modalDownloadBtn) {
    modalDownloadBtn.onclick = (e) => {
      e.stopPropagation();
      if (currentPhoto && currentPhoto.driveId) {
        downloadFromDrive(currentPhoto.driveId);
      } else {
        showPopup("Download not available for this photo");
      }
    };
  }

  const hasMultiple = currentGalleryPhotos.length > 1;
  if (prevBtn) prevBtn.style.display = hasMultiple ? "flex" : "none";
  if (nextBtn) nextBtn.style.display = hasMultiple ? "flex" : "none";
}

// ==========================================
// MOBILE PINCH-TO-ZOOM & PAN SYSTEM
// ==========================================
let currentScale = 1;
let panX = 0;
let panY = 0;

let isPinching = false;
let isPanning = false;
let startPinchDist = 0;
let startScale = 1;
let startTouchX = 0;
let startTouchY = 0;
let hasPanMoved = false;

function updateModalTransform(smooth = false) {
  const modalImg = document.getElementById("modalImage");
  if (!modalImg) return;

  if (smooth) {
    modalImg.style.transition = "transform 0.25s cubic-bezier(0.2, 0, 0.2, 1)";
  } else {
    modalImg.style.transition = "none";
  }

  if (currentScale > 1.05) {
    modalImg.style.transform = `translate(${panX}px, ${panY}px) scale(${currentScale})`;
  } else {
    modalImg.style.transform = "translate(0px, 0px) scale(1)";
  }
}

function resetModalZoom() {
  currentScale = 1;
  panX = 0;
  panY = 0;
  isPinching = false;
  isPanning = false;
  hasPanMoved = false;
  const modal = document.getElementById("imageModal");
  if (modal) modal.classList.remove("zoomed");
  updateModalTransform(true);
}

function clampModalPan() {
  const modalImg = document.getElementById("modalImage");
  if (!modalImg || currentScale <= 1.05) return;

  const scaledW = modalImg.offsetWidth * currentScale;
  const scaledH = modalImg.offsetHeight * currentScale;

  const maxPanX = Math.max(0, (scaledW - window.innerWidth * 0.9) / 2 + 60);
  const maxPanY = Math.max(0, (scaledH - window.innerHeight * 0.9) / 2 + 60);

  panX = Math.min(maxPanX, Math.max(-maxPanX, panX));
  panY = Math.min(maxPanY, Math.max(-maxPanY, panY));
}

// Touch Pinch Zoom & Drag Pan Event Listeners
modalImg.addEventListener("touchstart", (e) => {
  if (e.touches.length === 2) {
    isPinching = true;
    isPanning = false;
    startPinchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    startScale = currentScale;
  } else if (e.touches.length === 1 && currentScale > 1.05) {
    isPanning = true;
    isPinching = false;
    hasPanMoved = false;
    startTouchX = e.touches[0].clientX - panX;
    startTouchY = e.touches[0].clientY - panY;
  }
}, { passive: true });

modalImg.addEventListener("touchmove", (e) => {
  const modal = document.getElementById("imageModal");

  if (e.touches.length === 2 && isPinching) {
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    if (startPinchDist > 0) {
      const factor = dist / startPinchDist;
      currentScale = Math.min(4, Math.max(1, startScale * factor));
      if (currentScale > 1.05) {
        if (modal) modal.classList.add("zoomed");
      } else {
        if (modal) modal.classList.remove("zoomed");
      }
      clampModalPan();
      updateModalTransform(false);
    }
  } else if (e.touches.length === 1 && isPanning && currentScale > 1.05) {
    const newPanX = e.touches[0].clientX - startTouchX;
    const newPanY = e.touches[0].clientY - startTouchY;

    if (Math.abs(newPanX - panX) > 4 || Math.abs(newPanY - panY) > 4) {
      hasPanMoved = true;
    }

    panX = newPanX;
    panY = newPanY;
    clampModalPan();
    updateModalTransform(false);
  }
}, { passive: true });

modalImg.addEventListener("touchend", (e) => {
  if (e.touches.length < 2) {
    isPinching = false;
  }
  if (e.touches.length === 0) {
    isPanning = false;
    if (currentScale < 1.05) {
      resetModalZoom();
    } else {
      updateModalTransform(true);
    }
  }
});

// Click / Tap Zoom Toggle (Desktop & Mobile Tap)
modalImg.addEventListener("click", (e) => {
  e.stopPropagation();

  if (hasPanMoved) {
    hasPanMoved = false;
    return;
  }

  if (currentScale > 1.05) {
    resetModalZoom();
  } else {
    currentScale = 2.2;
    const modal = document.getElementById("imageModal");
    if (modal) modal.classList.add("zoomed");

    const rect = modalImg.getBoundingClientRect();
    const clickXRel = e.clientX - (rect.left + rect.width / 2);
    const clickYRel = e.clientY - (rect.top + rect.height / 2);
    panX = -clickXRel * (currentScale - 1);
    panY = -clickYRel * (currentScale - 1);

    clampModalPan();
    updateModalTransform(true);
  }
});

function showNextPhoto() {
  if (currentGalleryPhotos.length <= 1) return;
  hideSwipeHint();
  startIdleSwipeTimer();
  resetModalZoom();
  currentPhotoIndex = (currentPhotoIndex + 1) % currentGalleryPhotos.length;
  updateModalImage();
}

function showPrevPhoto() {
  if (currentGalleryPhotos.length <= 1) return;
  hideSwipeHint();
  startIdleSwipeTimer();
  resetModalZoom();
  currentPhotoIndex = (currentPhotoIndex - 1 + currentGalleryPhotos.length) % currentGalleryPhotos.length;
  updateModalImage();
}

// Prev / Next button click handlers
const modalPrevBtn = document.getElementById("modalPrevBtn");
const modalNextBtn = document.getElementById("modalNextBtn");

if (modalPrevBtn) {
  modalPrevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showPrevPhoto();
  });
}

if (modalNextBtn) {
  modalNextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showNextPhoto();
  });
}

// Touch Swipe Gestures (Left / Right when not zoomed)
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

modal.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1 && currentScale <= 1.05) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }
}, { passive: true });

modal.addEventListener("touchend", (e) => {
  if (modal.style.display !== "flex") return;
  if (currentScale > 1.05) return;

  if (e.changedTouches.length === 1) {
    touchEndX = e.changedTouches[0].clientX;
    touchEndY = e.changedTouches[0].clientY;
    handleSwipeGesture();
  }
});

function handleSwipeGesture() {
  const deltaX = touchEndX - touchStartX;
  const deltaY = touchEndY - touchStartY;
  const minSwipeDistance = 40;

  if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
    hideSwipeHint();
    startIdleSwipeTimer();
    if (deltaX < 0) {
      showNextPhoto(); // Swipe left -> Next photo
    } else {
      showPrevPhoto(); // Swipe right -> Previous photo
    }
  }
}

document.getElementById("closeModal").onclick = () => {
  closeModal();
};

function closeModal() {
  const modal = document.getElementById("imageModal");

  hideSwipeHint();
  stopIdleSwipeTimer();
  resetModalZoom();
  modal.style.display = "none";

  if (isModalOpen) {
    isModalOpen = false;
    if (isModalOpen && history.state?.modal) {
      history.back();
    }
  }
}

window.addEventListener("popstate", () => {
  const modal = document.getElementById("imageModal");

  if (modal.style.display === "flex") {
    resetModalZoom();
    modal.style.display = "none";
    isModalOpen = false;
  }
});

document.addEventListener("keydown", (e) => {
  if (modal.style.display === "flex") {
    if (e.key === "Escape") {
      closeModal();
    } else if (e.key === "ArrowRight" && currentScale <= 1.05) {
      showNextPhoto();
    } else if (e.key === "ArrowLeft" && currentScale <= 1.05) {
      showPrevPhoto();
    }
  }
});

modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    closeModal();
  }
});



// ==========================================
// UI HELPERS
// ==========================================
function showLoader(text, mode = "default") {
  loader.style.display = "flex";
  loaderText.innerText = text;

  const messages = document.querySelector(".loader-messages");

  if (mode === "fast") {
    messages.innerHTML = `
      <div>⚡ Fast scan running</div>
      <div>📱 Tuned for your device</div>
      <div>🧠 Analyzing facial features</div>
      <div>🔍 Matching facial features</div>
    `;
  }
  else if (mode === "accurate") {
    messages.innerHTML = `
      <div>🧠 Running deep face analysis</div>
      <div>🔍 Enhancing detection accuracy</div>
      <div>📱 Processing speed varies by your device</div>
      <div>🎯 Refining match precision</div>
    `;
  }
}

function hideLoader() {
  loader.style.display = "none";
}

function showScreenMessage(message) {
  currentGalleryPhotos = [];
  results.innerHTML = `
    <div class="empty-state-wrapper">
      <div class="empty-state">${message}</div>
    </div>
  `;
}

window.showPopup = function (message, isHTML = false) {
  const el = document.getElementById("popupMessage");

  if (isHTML) {
    el.innerHTML = message;
  } else {
    el.innerHTML = `
      <div>${message}</div>
      <div style="margin-top:15px; text-align:center;">
        <button onclick="closePopup()" class="popup-btn primary">OK</button>
      </div>
    `;
  }
  document.getElementById("popupOverlay").style.display = "flex";
};

window.closePopup = function () {
  document.getElementById("popupOverlay").style.display = "none";
};


// ==========================================
// UPLOAD HANDLER
// ==========================================
uploadBtn.addEventListener("click", () => {
  showUploadChoice();
});


async function handleFileSelection(file) {
  if (!file) return;

  debugSeparator("New Upload");

  try {
    // =========================
    // FAST MODE
    // =========================
    showLoader("Processing (Fast Mode)", "fast");

    let result = await processImageInIframe(file, "fast");
    debugLog(`🎯 Photo Confidence : ${(result.confidence * 100).toFixed(3)}`);


    hideLoader();

    if (!result || result.error) {
      debugLog(`‼️Failed to detect a face in the uploaded photo`)
      debugLog(`‼️${result.error}`)
      showPopup(result?.error || "Failed to detect a face in the uploaded photo");
      return;
    }

    let confidence = result.confidence || 0;

    // =========================
    // FALLBACK TO ACCURATE
    // =========================
    if (confidence < 0.2) {

      debugLog(`⚠️ Uploaded photo has low confidence`);

      showDecisionPopup(
        async () => {
          // YES → run accurate
          showLoader("Processing (Accurate Mode)", "accurate");

          let deepResult = await processImageInIframe(file, "accurate");

          hideLoader();
          debugLog(`🎯 Photo Confidence : ${(deepResult.confidence * 100).toFixed(3)}`);

          if (!deepResult || deepResult.error) {
            debugLog(`‼️Failed to detect a face in the uploaded photo`)
            debugLog(`‼️${deepResult.error}`)
            showPopup(deepResult?.error || "Accurate processing failed");
            return;
          }

          const matches = matchSelfieToMaster(
            deepResult.descriptor,
            CURRENT_THRESHOLD
          );

          showMatches(matches);
        },

        () => {
          // NO → continue fast result
          const matches = matchSelfieToMaster(
            result.descriptor,
            CURRENT_THRESHOLD
          );

          showMatches(matches);
        },
        (result.confidence * 100).toFixed(3)
      );

      return; // IMPORTANT → stop further execution
    }

    // =========================
    // MATCH
    // =========================
    const matches = matchSelfieToMaster(result.descriptor, CURRENT_THRESHOLD);
    showMatches(matches);

  } catch (err) {
    hideLoader();
    debugLog(`‼️${err.message}`)
    showPopup("Face matching failed");
    console.error(err);
  }
}

//Iframe Function
window.addEventListener("message", (e) => {
  if (e.data === "FAST_READY") {
    fastFrameReady = true;
    debugLog("✅ Fast iframe ready");
  }

  if (e.data === "ACCURATE_READY") {
    accurateFrameReady = true;
    debugLog("✅ Accurate iframe ready");
  }


  if (e.data?.type === "TF_MEMORY") {
    const m = e.data.memory;

    debugLog(`🧠 Tensors : ${m.numTensors}`);
    debugLog(`🧠 Buffers : ${m.numDataBuffers}`);
    debugLog(`🧠 Memory : ${(m.numBytes / 1024 / 1024).toFixed(2)} MB`);
  }
});

// Gallery input
galleryInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  handleFileSelection(file);
  galleryInput.value = "";
});


function showDecisionPopup(onYes, onNo, confidence) {
  const overlay = document.getElementById("popupOverlay");
  const msg = document.getElementById("popupMessage");

  msg.innerHTML = `
    <div>
      
      <h4>⚠️ Low Upload Photo Quality</h4>
      <div style="border-top:1px solid #eee; padding-top:12px; margin: 15px 20px 0px 20px; line-height:1.6;"></div>
    
      <div style="margin-bottom:6px; font-size:13px; font-weight:400; font-color:#9aa4b2; margin:0px 10px 10px 10px;">
        Face Detection Confidence: <b>${confidence}%</b>
      </div>

      
      <div class="threshold-label">
        Possible Reasons : 
      </div>

      <ul>
        <li>📱 Auto photo enhancement or beauty filters</li>
        <li>📷 Low camera quality or heavy compression</li>
        <li>🌙 Poor lighting or shadows on face</li>
        <li>🔄 Face not clear or not properly aligned</li>
      </ul>

      <div style="border-top:1px solid #eee; padding-top:12px; margin: 15px 20px 0px 20px; line-height:1.6;"></div>
      <div class="threshold-desc">
        ℹ️ Despite low confidence, matching<br> results may still be shown
      </div>

    
      <button id="popupYes" class="option-btn">🔎 Deep Scan</button>
      <button id="popupNo" class="option-btn">➡️ Continue</button>
      
    </div>
  `;

  overlay.style.display = "flex";

  document.getElementById("popupYes").onclick = () => {
    overlay.style.display = "none";
    onYes();
  };

  document.getElementById("popupNo").onclick = () => {
    overlay.style.display = "none";
    onNo();
  };
}


// ==========================================
// THRESHOLD HANDLER
// ==========================================
function percentToThreshold(percent) {
  // 30% -> 0.6 (loose)
  // 90% -> 0.3 (strict but usable)

  const minP = 30;
  const maxP = 90;

  const minT = 0.6;
  const maxT = 0.3;

  const ratio = (percent - minP) / (maxP - minP);

  return minT + (maxT - minT) * ratio;
}

// Convert threshold → slider %
function thresholdToPercent(threshold) {
  const minP = 30;
  const maxP = 90;

  const minT = 0.6;
  const maxT = 0.3;

  const ratio = (threshold - minT) / (maxT - minT);

  return Math.round(minP + ratio * (maxP - minP));
}


function initThresholdSlider() {

  const defaultPercent = thresholdToPercent(CURRENT_THRESHOLD);

  thresholdSlider.value = defaultPercent;
  thresholdPercentText.innerText = defaultPercent + "%";

  thresholdSlider.addEventListener("input", () => {
    const percent = parseInt(thresholdSlider.value);

    CURRENT_THRESHOLD = percentToThreshold(percent);

    thresholdPercentText.innerText = percent + "%";

    if (DEBUG_MODE) {
      debugLog(`Threshold updated → ${CURRENT_THRESHOLD.toFixed(3)} (${percent}%)`);
    }
  });
}



// ==========================================
// SHOW CAMERA
// ==========================================
function showUploadChoice() {
  const popup = document.getElementById("uploadOverlay");
  popup.style.display = "flex";
}


window.closeUploadPopup = function () {
  document.getElementById("uploadOverlay").style.display = "none";
};


document.getElementById("uploadPhotoBtn").onclick = () => {
  closeUploadPopup();
  galleryInput.click();
};



// ==========================================
// LAYOUT CYCLER 
// ==========================================
let currentCols = 2; // default

results.classList.add("cols-2");

layoutBtn.addEventListener("click", () => {

  // remove old class
  results.classList.remove(
    "cols-1", "cols-2", "cols-3", "cols-4"
  );

  currentCols++;

  const isMobile = window.innerWidth <= 768;
  const maxCols = isMobile ? 3 : 4;

  if (currentCols > maxCols) {
    currentCols = 1;
  }

  results.classList.add("cols-" + currentCols);
  showDockHint("🔲 Grid layout set to " + currentCols + " column" + (currentCols > 1 ? "s" : ""));
});


// ==========================================
// DEBUG PANEL
// ==========================================
function getTimeStamp() {
  const now = new Date();

  const time = now.toLocaleTimeString("en-IN", {
    hour12: false
  });

  const ms = now.getMilliseconds().toString().padStart(3, "0");

  return `${time}.${ms}`;
}

function debugLog(message) {
  if (!DEBUG_MODE) return;

  const time = getTimeStamp();
  const formatted = `[${time}] ${message}`;

  console.log("[DEBUG]", formatted);

  const content = document.getElementById("debugContent");

  const line = document.createElement("div");
  line.textContent = formatted;

  content.appendChild(line);
  content.scrollTop = content.scrollHeight;
}

let lastExpandedHeight = 220;

debugToggleBtn.addEventListener("click", () => {
  const isMinimized = debugPanel.classList.contains("minimized");

  if (isMinimized) {
    // 🔼 EXPAND
    debugPanel.classList.remove("minimized");

    // restore previous height
    debugPanel.style.height = lastExpandedHeight + "px";

    debugToggleBtn.innerText = "−";

  } else {
    // 🔽 MINIMIZE

    // save current height BEFORE removing it
    lastExpandedHeight = debugPanel.offsetHeight;

    debugPanel.classList.add("minimized");

    // 🔑 IMPORTANT: remove inline height so CSS works
    debugPanel.style.height = "";

    debugToggleBtn.innerText = "▲";
  }
});

if (DEBUG_MODE) {
  document.getElementById("debugPanel").style.display = "flex";
}

function debugSeparator(label = "New Session") {
  if (!DEBUG_MODE) return;

  const content = document.getElementById("debugContent");

  const line = document.createElement("div");

  line.style.margin = "10px 0";
  line.style.padding = "6px 0";
  line.style.borderTop = "1px solid rgba(255,255,255,0.2)";
  line.style.borderBottom = "1px solid rgba(255,255,255,0.2)";
  line.style.textAlign = "center";
  line.style.color = "#00ffcc";
  line.style.fontWeight = "600";

  const time = getTimeStamp();
  line.textContent = `=== ${label} @ ${time} ===`;

  content.appendChild(line);
  content.scrollTop = content.scrollHeight;
}

let tapCount = 0;
let tapTimer = null;

eventTitleEl.addEventListener("click", () => {
  tapCount++;

  clearTimeout(tapTimer);

  tapTimer = setTimeout(() => {
    tapCount = 0;
  }, 2000); // reset if user pauses

  if (tapCount >= 5) {
    DEBUG_MODE = true;

    document.getElementById("debugPanel").style.display = "flex";

    debugLog("🔥 Debug mode activated via title tap");

    tapCount = 0;
  }
});

let isDragging = false;
let startY = 0;
let startHeight = 0;

const debugHeader = document.querySelector(".debug-header");

debugHeader.addEventListener("mousedown", startDrag);
debugHeader.addEventListener("touchstart", startDrag);

function startDrag(e) {
  isDragging = true;

  startY = e.touches ? e.touches[0].clientY : e.clientY;
  startHeight = debugPanel.offsetHeight;

  document.addEventListener("mousemove", onDrag);
  document.addEventListener("mouseup", stopDrag);

  document.addEventListener("touchmove", onDrag);
  document.addEventListener("touchend", stopDrag);
}

function onDrag(e) {
  if (!isDragging) return;

  debugPanel.classList.remove("minimized");

  const currentY = e.touches ? e.touches[0].clientY : e.clientY;
  const diff = startY - currentY;

  let newHeight = startHeight + diff;

  // limits
  if (newHeight < 100) newHeight = 100;
  if (newHeight > window.innerHeight * 0.9) newHeight = window.innerHeight * 0.9;

  debugPanel.style.height = newHeight + "px";
}

function stopDrag() {
  isDragging = false;

  document.removeEventListener("mousemove", onDrag);
  document.removeEventListener("mouseup", stopDrag);

  document.removeEventListener("touchmove", onDrag);
  document.removeEventListener("touchend", stopDrag);
}


// ==========================================
// SHARE BUTTON
// ==========================================
shareBtn.addEventListener("click", () => {
  showDockHint("🔗 Share link copied!");

  const shareURL = `https://madilu.family/eventnew.html?event=${encodeURIComponent(eventName)}`;

  if (navigator.share) {
    navigator.share({
      title: "Madilu Family Event Photos",
      text: "Find your photos using face match",
      url: shareURL
    }).catch(() => { });
  } else {
    navigator.clipboard.writeText(shareURL);
    showPopup("Share link copied!");
  }
});

// ==========================================
// PHOTOGRAPHER / CREDITS INFO
// ==========================================
let photographerData = null;

function formatPhotographerName(name) {
  if (!name) return "";
  return name
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getInitials(name) {
  const clean = (name || "").replace(/[^a-zA-Z0-9]/g, "").trim();
  if (!clean) return "PH";
  return clean.slice(0, 2).toUpperCase();
}

async function checkAndLoadPhotographerInfo() {
  try {
    if (!PHOTOGRAPHER_JSON_URL) return;
    const res = await fetch(PHOTOGRAPHER_JSON_URL, { cache: "no-cache" });
    if (!res.ok) {
      console.warn(`[Photographer Info] photographer.json not found for event '${eventName}' (HTTP ${res.status}). Button remains hidden as per rules.`);
      return;
    }

    const data = await res.json();
    const name = data?.photographer_name || data?.name;
    const phone = data?.phone_number || data?.phone;

    if (!data || !name || !phone) {
      console.warn("[Photographer Info] photographer.json is missing required photographer_name or phone_number.", data);
      return;
    }

    photographerData = data;

    const infoBtn = document.getElementById("photographerInfoBtn");
    if (infoBtn) {
      infoBtn.style.display = "inline-flex";
      infoBtn.addEventListener("click", () => {
        hideInfoHintToast();
        showPhotographerModal();
      });
      infoBtn.addEventListener("mouseenter", () => {
        showInfoHintToast("📸 Tap for Photographer Info", 2500);
      });
    }

    const infoHintToast = document.getElementById("infoHintToast");
    if (infoHintToast) {
      infoHintToast.addEventListener("click", () => {
        hideInfoHintToast();
        showPhotographerModal();
      });
    }

    // Automatically display hint popup for photographer & hosting info
    showInfoHintToast("📸 Tap for Photographer Info", 2500);
  } catch (err) {
    console.warn("[Photographer Info] Failed to load photographer info:", err);
  }
}

function showPhotographerModal() {
  if (!photographerData) return;

  const modal = document.getElementById("photographerModal");
  const logoCircle = document.getElementById("photographerLogoCircle");
  const nameEl = document.getElementById("photographerModalName");
  const phoneEl = document.getElementById("photographerModalPhone");
  const actionGrid = document.getElementById("photographerActionGrid");

  if (!modal || !logoCircle || !nameEl || !phoneEl || !actionGrid) return;

  const displayName = formatPhotographerName(photographerData.photographer_name);
  nameEl.textContent = displayName;
  phoneEl.textContent = photographerData.phone_number;

  // Render Logo image or fallback initials
  logoCircle.innerHTML = "";
  const initials = getInitials(photographerData.photographer_name);

  if (photographerData.logo_url) {
    const img = document.createElement("img");
    img.src = `${photographerData.logo_url}?t=${Date.now()}`;
    img.alt = displayName;
    img.className = "photographer-logo-img";
    img.onerror = () => {
      logoCircle.innerHTML = `<span class="photographer-initials">${initials}</span>`;
    };
    logoCircle.appendChild(img);
  } else {
    logoCircle.innerHTML = `<span class="photographer-initials">${initials}</span>`;
  }

  // Action items
  actionGrid.innerHTML = "";

  // 1. Call (Phone - mandatory)
  actionGrid.appendChild(createActionLink({
    href: `tel:${photographerData.phone_number}`,
    text: "Call",
    iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`
  }));

  // 2. Email (optional)
  if (photographerData.email_id) {
    actionGrid.appendChild(createActionLink({
      href: `mailto:${photographerData.email_id}`,
      text: "Email",
      iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`
    }));
  }

  // 3. Instagram (optional)
  if (photographerData.instagram_id) {
    const handle = photographerData.instagram_id.replace(/^@/, "");
    actionGrid.appendChild(createActionLink({
      href: `https://instagram.com/${handle}`,
      text: "Instagram",
      iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`
    }));
  }

  // 4. Facebook (optional)
  if (photographerData.facebook_id) {
    const fbHandle = photographerData.facebook_id.startsWith("http")
      ? photographerData.facebook_id
      : `https://facebook.com/${photographerData.facebook_id}`;
    actionGrid.appendChild(createActionLink({
      href: fbHandle,
      text: "Facebook",
      iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>`
    }));
  }

  // 5. Website (optional)
  if (photographerData.website_url) {
    let siteUrl = photographerData.website_url;
    if (!/^https?:\/\//i.test(siteUrl)) {
      siteUrl = `https://${siteUrl}`;
    }
    actionGrid.appendChild(createActionLink({
      href: siteUrl,
      text: "Website",
      iconSvg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`
    }));
  }

  modal.style.display = "flex";
}

function createActionLink({ href, text, iconSvg }) {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.className = "photographer-action-btn";
  a.innerHTML = `${iconSvg} <span>${text}</span>`;
  return a;
}

function closePhotographerModal() {
  const modal = document.getElementById("photographerModal");
  if (modal) {
    modal.style.display = "none";
  }
}

document.getElementById("closePhotographerModalBtn")?.addEventListener("click", closePhotographerModal);

document.getElementById("photographerModal")?.addEventListener("click", (e) => {
  if (e.target.id === "photographerModal") {
    closePhotographerModal();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closePhotographerModal();
  }
});

// ==========================================
// INITIAL LOAD
// ==========================================
(async () => {
  try {
    showLoader("Loading Event Photos");
    await checkAndLoadPhotographerInfo();
    await loadMasterBinFromUrl(MASTER_BIN_URL);
    await loadMasterJson(MASTER_JSON_URL);
    initThresholdSlider();
    hideLoader();
    showAllPhotos();
    showDockHint("✨ Tap <strong>Find Photo</strong> to match your face!");
  } catch (err) {
    console.log(err.message)
    hideLoader();
    showScreenMessage("Unable to load event photos.");
  }
})();

// ==========================================
// 3-SECOND ACTION HINT TOAST & INFO HINT TOAST
// ==========================================
let dockHintTimer = null;
window.showDockHint = function (message) {
  const toastEl = document.getElementById("dockHintToast");
  const textEl = document.getElementById("dockHintText");
  if (!toastEl || !textEl) return;

  textEl.innerHTML = message;
  toastEl.classList.remove("hidden");

  clearTimeout(dockHintTimer);
  dockHintTimer = setTimeout(() => {
    toastEl.classList.add("hidden");
  }, 2500);
};

let infoHintTimer = null;
window.showInfoHintToast = function (message = "📸 Tap for Photographer Info", duration = 2500) {
  const toastEl = document.getElementById("infoHintToast");
  const textEl = document.getElementById("infoHintText");
  if (!toastEl) return;

  if (textEl && message) {
    textEl.innerHTML = message;
  }

  toastEl.style.display = "flex";
  void toastEl.offsetWidth;
  toastEl.classList.remove("hidden");

  clearTimeout(infoHintTimer);
  if (duration > 0) {
    infoHintTimer = setTimeout(() => {
      toastEl.classList.add("hidden");
    }, duration);
  }
};

window.hideInfoHintToast = function () {
  const toastEl = document.getElementById("infoHintToast");
  if (toastEl) {
    toastEl.classList.add("hidden");
  }
  clearTimeout(infoHintTimer);
};
