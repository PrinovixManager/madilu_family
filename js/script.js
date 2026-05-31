document.addEventListener("DOMContentLoaded", function () {
    const cover = document.getElementById('inviteCover');
    const music = document.getElementById('inviteMusic');
    let animationsStarted = false;

    // Trigger sliding animation and audio activation when clicking the cover page
    cover.addEventListener('click', function () {
        cover.classList.add('opened');
        document.body.classList.add('unlocked');
        
        // ADDED: Music handling setup safely bypassed browser autoplay policy block hooks
        if (music) {
            music.play().catch(error => {
                console.log("Audio play interaction safely caught: ", error);
            });
        }
        
        // Start falling flowers when invitation opens
        if (!animationsStarted) {
            initFlowerShower();
            animationsStarted = true;
        }
    });

    // Smooth scroll configuration for anchor tags
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    /* ======================================================
       High-Performance HTML5 Canvas Flower Falling Animation
       ====================================================== */
    function initFlowerShower() {
        const canvas = document.getElementById("flowerCanvas");
        const ctx = canvas.getContext("2d");

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);

        const totalPetals = 15;
        const petals = [];

        const petalColors = [
            { r: 255, g: 140, b: 0,   a: 0.8 }, 
            { r: 255, g: 215, b: 0,   a: 0.85 },
            { r: 255, g: 248, b: 220, a: 0.9 }  
        ];

        class Petal {
            constructor() {
                this.reset();
                this.y = Math.random() * -canvas.height; 
            }

            reset() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * -100 - 20;
                this.size = Math.random() * 4 + 2; 
                this.speedY = Math.random() * 1.1 + 1; 
                this.speedX = Math.random() * 1 - 0.5; 
                this.rotation = Math.random() * 360;
                this.rotationSpeed = Math.random() * 2 - 1;
                this.color = petalColors[Math.floor(Math.random() * petalColors.length)];
            }

            update() {
                this.y += this.speedY;
                this.x += this.speedX + Math.sin(this.y / 30) * 0.4; 
                this.rotation += this.rotationSpeed;

                if (this.y > canvas.height + 20 || this.x < -20 || this.x > canvas.width + 20) {
                    this.reset();
                }
            }

            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate((this.rotation * Math.PI) / 180);
                
                ctx.beginPath();
                ctx.ellipse(0, 0, this.size, this.size / 1.6, 0, 0, 2 * Math.PI);
                ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.color.a})`;
                ctx.fill();
                
                ctx.restore();
            }
        }

        for (let i = 0; i < totalPetals; i++) {
            petals.push(new Petal());
        }

        function renderLoop() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            for (let i = 0; i < petals.length; i++) {
                petals[i].update();
                petals[i].draw();
            }
            
            requestAnimationFrame(renderLoop);
        }
        
        requestAnimationFrame(renderLoop);
    }
});