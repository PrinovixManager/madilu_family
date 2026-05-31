const imageGallery = document.getElementById('imageGallery');

imageIds.forEach(imageInfo => {
    const imageId = imageInfo[0];
    const imageUrl = imageInfo[1];

    const imageContainer = document.createElement('div');
    imageContainer.classList.add('image-container');
    imageContainer.style.position = 'relative';
    //imageContainer.style.boxShadow = '0 10px 18px rgba(0, 0, 0, 0.5)';
   // imageContainer.style.borderRadius = '20px';

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = `Image ${imageIds.indexOf(imageInfo) + 1}`;
    img.style.display = 'block';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.cursor = 'pointer';
    img.style.boxSizing = 'border-box';
    img.style.borderRadius = '10px';
    img.style.boxShadow = '0 10px 18px rgba(0, 0, 0, 0.2)';


    const downloadLink = document.createElement('a');
    downloadLink.href = `https://drive.usercontent.google.com/u/0/uc?id=${imageId}&export=download`;
    downloadLink.classList.add('download-button');
    downloadLink.textContent = '';
    downloadLink.download = `image_${imageIds.indexOf(imageInfo) + 1}`;
    downloadLink.style.position = 'absolute';
    downloadLink.style.top = '10px';
    downloadLink.style.right = '10px';
    downloadLink.style.backgroundColor = 'transparent'; /* Make background transparent */
    downloadLink.style.color = 'white';
    downloadLink.style.padding = '0';             /* Remove padding */
    downloadLink.style.borderRadius = '0';         /* Remove border radius */
    downloadLink.style.zIndex = '10';
    downloadLink.style.display = 'flex';
    downloadLink.style.alignItems = 'center';
    downloadLink.style.justifyContent = 'center';
    downloadLink.style.opacity = '1';
    downloadLink.style.boxShadow = 'none';       /* Remove shadow */

    const downloadIcon = document.createElement('img');
    downloadIcon.src = 'img/download.png';
    downloadIcon.alt = 'Download Image';
    downloadIcon.style.width = '64px';
    downloadIcon.style.height = '64px';
    downloadIcon.style.marginRight = '0';

    downloadLink.appendChild(downloadIcon);

    imageContainer.appendChild(img);
    imageContainer.appendChild(downloadLink);
    imageGallery.appendChild(imageContainer);

    img.addEventListener('click', () => {
        if (img.requestFullscreen) {
            img.requestFullscreen();
        } else if (img.mozRequestFullScreen) {
            img.mozRequestFullScreen();
        } else if (img.webkitRequestFullscreen) {
            img.webkitRequestFullscreen();
        } else if (img.msRequestFullscreen) {
            img.msRequestFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            downloadLink.style.opacity = '0';
        } else {
            downloadLink.style.opacity = '1';
        }
    });
});



