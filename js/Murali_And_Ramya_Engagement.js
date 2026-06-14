// =====================================================
// EVENT FACE MATCH - FULL MERGED VERSION
// =====================================================

// ==========================================
// Data holders
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


const eventTitleEl = document.getElementById("eventTitle");



const thresholdSlider = document.getElementById("thresholdSlider");
const thresholdPercentText = document.getElementById("thresholdPercent");


// ==========================================
// UPDATE HERE
// ==========================================
const eventName = "Murali_And_Ramya_Engagement"




// ==========================================
// EVENT PARAM
// ==========================================
const params = new URLSearchParams(window.location.search);


if (!eventName) {
  showScreenMessage("Event not specified");
  throw new Error("Event missing");
}

document.getElementById("eventTitle").innerText =
  `${eventName.replace(/_/g, " ").toUpperCase()}`;



// ==========================================
// R2 PUBLIC URLS (DOMAIN BASED)
// ==========================================
//const domain = window.location.hostname;
let url_enventName=eventName.toLowerCase();
const MASTER_BIN_URL = `https://cdn.prinopix.com/production/photo_hosting/${url_enventName}/master_bin/master.bin`;

const MASTER_JSON_URL = `https://cdn.prinopix.com/production/photo_hosting/${url_enventName}/master_json/master.json`;


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
    throw new Error("Iframe element missing");
  }


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
// SHOW ALL PHOTOS
// ==========================================
function showAllPhotos() {
  results.innerHTML = "";
  for (const filename in masterMeta) {
    const data = masterMeta[filename];
    createPhotoCard(data.downloadURL, data.photoDriveId);
  }
}

showAllBtn.addEventListener("click", showAllPhotos);



// ==========================================
// SHOW MATCHED PHOTOS 
// ==========================================
function showMatches(matches) {
  results.innerHTML = "";

  if (!matches || matches.length === 0) {
    showScreenMessage("No matching photos found.");
    return;
  }

  matches.sort((a, b) => a.distance - b.distance);


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
}


// ==========================================
// PROFESSIONAL GALLERY RENDER
// ==========================================
function createPhotoCard(url, driveId) {
  const card = document.createElement("div");
  card.className = "photo-card";

  const img = document.createElement("img");
  img.src = url;
  img.loading = "lazy";
  img.onclick = () => openImageModal(url);

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
// IMAGE MODAL
// ==========================================
let isModalOpen = false;

function openImageModal(url) {
  const modal = document.getElementById("imageModal");
  const img = document.getElementById("modalImage");

  img.src = url;
  modal.style.display = "flex";

  // ✅ Only push if not already open
  if (!isModalOpen) {
    history.pushState({ modal: true }, "");
    isModalOpen = true;
  }

  img.style.touchAction = "manipulation";
}

document.getElementById("closeModal").onclick = () => {
  closeModal();
};

function closeModal() {
  const modal = document.getElementById("imageModal");

  modal.style.display = "none";
  modal.classList.remove("zoomed");

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
    modal.style.display = "none";
    modal.classList.remove("zoomed");
    isModalOpen = false;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    modal.classList.remove("zoomed");
  }
});


// ==========================================
// MODAL ZOOM (Desktop Click + Mobile Pinch)
// ==========================================
// Click to zoom (desktop)
modalImg.addEventListener("click", (e) => {
  e.stopPropagation();
  modal.classList.toggle("zoomed");
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
  results.innerHTML = `
    <div class="empty-state-wrapper">
      <div class="empty-state">${message}</div>
    </div>
  `;
}

window.showPopup = function(message, isHTML = false) {
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

window.closePopup = function() {
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



  try {
    // =========================
    // FAST MODE
    // =========================
    showLoader("Processing (Fast Mode)", "fast");

    let result = await processImageInIframe(file, "fast");



    hideLoader();

    if (!result || result.error) {
      showPopup(result?.error || "Failed to detect a face in the uploaded photo");
      return;
    }

    let confidence = result.confidence || 0;

    // =========================
    // FALLBACK TO ACCURATE
    // =========================
    if (confidence < 0.2) {



      showDecisionPopup(
        async () => {
          // YES → run accurate
          showLoader("Processing (Accurate Mode)", "accurate");
          let deepResult = await processImageInIframe(file, "accurate");
          hideLoader();
   

          if (!deepResult || deepResult.error) {
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
        (result.confidence*100).toFixed(3)
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
    showPopup("Face matching failed");
    console.error(err);
  }
}

//Iframe Function
window.addEventListener("message", (e) => {
  if (e.data === "FAST_READY") {
    fastFrameReady = true;

  }

  if (e.data === "ACCURATE_READY") {
    accurateFrameReady = true;

  }


  if (e.data?.type === "TF_MEMORY") {
    const m = e.data.memory;
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
function percentToThreshold(percent){
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
function thresholdToPercent(threshold){
  const minP = 30;
  const maxP = 90;

  const minT = 0.6;
  const maxT = 0.3;

  const ratio = (threshold - minT) / (maxT - minT);

  return Math.round(minP + ratio * (maxP - minP));
}


function initThresholdSlider(){

  const defaultPercent = thresholdToPercent(CURRENT_THRESHOLD);

  thresholdSlider.value = defaultPercent;
  thresholdPercentText.innerText = defaultPercent + "%";

  thresholdSlider.addEventListener("input", () => {
    const percent = parseInt(thresholdSlider.value);

    CURRENT_THRESHOLD = percentToThreshold(percent);

    thresholdPercentText.innerText = percent + "%";

  });
}



// ==========================================
// SHOW CAMERA
// ==========================================
function showUploadChoice() {
  const popup = document.getElementById("uploadOverlay");
  popup.style.display = "flex";
}


window.closeUploadPopup = function() {
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
    "cols-1","cols-2","cols-3","cols-4"
  );

  currentCols++;

  if(currentCols > 4){
    currentCols = 1;
  }

  results.classList.add("cols-" + currentCols);

});




// ==========================================
// INITIAL LOAD
// ==========================================
(async () => {
  try {
    showLoader("Loading Event Photos");
    await loadMasterBinFromUrl(MASTER_BIN_URL);
    await loadMasterJson(MASTER_JSON_URL);
    initThresholdSlider();
    hideLoader();
    showAllPhotos();
  } catch (err) {
    console.log(err.message)
    hideLoader();
    showScreenMessage("Unable to load event photos.");
  }
})();
