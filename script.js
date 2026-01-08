 /* --- GAME ENGINE --- */
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('game-container');
    
    let gameActive = false;
    let score = 0;

    // Resizing - Critical for layout change
    function resize() {
        // Use container dimensions instead of window to respect the control bar
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }
    window.addEventListener('resize', resize);
    
    // Game Objects
    const player = {
        x: 0, // Will set in resize/init
        y: 0,
        size: 40,
        speed: 5,
        dx: 0,
        dy: 0,
        emoji: "😎",
        invulnerable: 0
    };

    // Data: Items + Corresponding Player Face
    const items = [
        { 
            emoji: "🍕", 
            playerFace: "😋", 
            text: "You have the best taste in food (and girlfriends).", 
            title: "PIZZA POWER!", 
            color: "#FF9F1C" 
        },
        { 
            emoji: "💡", 
            playerFace: "🤔", 
            text: "Your ideas always inspire me.", 
            title: "BIG BRAIN ENERGY", 
            color: "#FFE66D" 
        },
        { 
            emoji: "🎵", 
            playerFace: "🕺", 
            text: "You bring rhythm and joy to my life.", 
            title: "VIBE CHECK PASSED", 
            color: "#00f3ff" 
        },
        { 
            emoji: "💪", 
            playerFace: "😤", 
            text: "I admire your strength and hustle.", 
            title: "GRIND MODE", 
            color: "#ff00ff" 
        },
        { 
            emoji: "❤️", 
            playerFace: "😍", 
            text: "FINAL REWARD: Demilade, you are my favorite person. I love you!", 
            title: "QUEST COMPLETE", 
            color: "#ff0000" 
        }
    ];

    let currentItemIndex = 0;
    let floatingItem = null;
    let particles = [];
    let obstacles = [];
    let gridOffset = 0;

    // Input Handling
    const keys = {};
    window.addEventListener('keydown', (e) => keys[e.key] = true);
    window.addEventListener('keyup', (e) => keys[e.key] = false);

    // Mobile Input Logic (Robust)
    let touchDirection = null;

    function setupMobileBtn(id, dir) {
        const btn = document.getElementById(id);
        
        const start = (e) => { 
            e.preventDefault(); // Stop scrolling/zoom
            touchDirection = dir; 
            btn.style.background = 'rgba(255,255,255,0.4)'; 
        };
        
        const end = (e) => { 
            e.preventDefault(); 
            if(touchDirection === dir) touchDirection = null; 
            btn.style.background = 'rgba(255,255,255,0.1)'; 
        };
        
        // Add listeners
        btn.addEventListener('touchstart', start, {passive: false});
        btn.addEventListener('touchend', end, {passive: false});
        // Mouse fallback for testing
        btn.addEventListener('mousedown', start);
        btn.addEventListener('mouseup', end);
        btn.addEventListener('mouseleave', end);
    }

    setupMobileBtn('btn-up', 'up');
    setupMobileBtn('btn-down', 'down');
    setupMobileBtn('btn-left', 'left');
    setupMobileBtn('btn-right', 'right');

    function handleInput() {
        if (!gameActive) return;

        player.dx = 0;
        player.dy = 0;

        // Keyboard
        if (keys['ArrowUp'] || keys['w']) player.dy = -player.speed;
        if (keys['ArrowDown'] || keys['s']) player.dy = player.speed;
        if (keys['ArrowLeft'] || keys['a']) player.dx = -player.speed;
        if (keys['ArrowRight'] || keys['d']) player.dx = player.speed;

        // Touch
        if (touchDirection === 'up') player.dy = -player.speed;
        if (touchDirection === 'down') player.dy = player.speed;
        if (touchDirection === 'left') player.dx = -player.speed;
        if (touchDirection === 'right') player.dx = player.speed;

        // Boundary Check & Movement
        if (player.x + player.dx > 0 && player.x + player.size + player.dx < canvas.width) player.x += player.dx;
        if (player.y + player.dy > 0 && player.y + player.size + player.dy < canvas.height) player.y += player.dy;
    }

    // Spawn Logic
    function spawnLevel() {
        if (currentItemIndex >= items.length) return; // Win State logic handled in update

        // Update player emoji to match what they are hunting (or current mood)
        player.emoji = items[currentItemIndex].playerFace;
        
        // Spawn Item with Distance Check
        let validSpawn = false;
        let attempts = 0;
        // Require item to be at least 60% of the screen dimension away
        const minDistance = Math.min(canvas.width, canvas.height) * 0.6; 

        while (!validSpawn && attempts < 20) {
            const testX = Math.random() * (canvas.width - 60) + 30;
            const testY = Math.random() * (canvas.height - 60) + 30;

            const dx = testX - player.x;
            const dy = testY - player.y;
            const distance = Math.sqrt(dx*dx + dy*dy);

            if (distance > minDistance) {
                floatingItem = {
                    x: testX,
                    y: testY,
                    size: 35,
                    angle: 0,
                    data: items[currentItemIndex]
                };
                validSpawn = true;
            }
            attempts++;
        }

        // Fallback
        if (!validSpawn) {
            floatingItem = {
                x: Math.random() * (canvas.width - 60) + 30,
                y: Math.random() * (canvas.height - 60) + 30,
                size: 35,
                angle: 0,
                data: items[currentItemIndex]
            };
        }

        // Spawn Obstacles (Increase with level)
        obstacles = [];
        let obstacleCount = currentItemIndex + 3; // Base difficulty

        // Final Level Challenge: Adjusted to be more fair
        if (currentItemIndex === items.length - 1) {
            obstacleCount = 10; // Reduced from 20 to 10 for better playability
        }

        for(let i=0; i<obstacleCount; i++) {
            obstacles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: 30,
                speedX: (Math.random() - 0.5) * 4,
                speedY: (Math.random() - 0.5) * 4,
                emoji: "👾"
            });
        }
    }

    // Particle System
    class Particle {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 5 + 2;
            this.speedX = Math.random() * 6 - 3;
            this.speedY = Math.random() * 6 - 3;
            this.color = color;
            this.life = 100;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.life -= 2;
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.life / 100;
            ctx.fillRect(this.x, this.y, this.size, this.size);
            ctx.globalAlpha = 1;
        }
    }

    function createExplosion(x, y, color) {
        for (let i = 0; i < 20; i++) {
            particles.push(new Particle(x, y, color));
        }
    }

    // Modal Logic
    const modal = document.getElementById('message-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');

    function showMessage(itemData) {
        gameActive = false; // Pause
        modalTitle.innerText = itemData.title;
        modalTitle.style.color = itemData.color;
        modalText.innerText = itemData.text;
        
        if (currentItemIndex === items.length - 1) {
             createExplosion(canvas.width/2, canvas.height/2, '#ff0000');
        }

        modal.classList.add('active');
        score++;
        document.getElementById('scoreVal').innerText = score;
        currentItemIndex++;
    }

    function closeModal() {
        modal.classList.remove('active');
        if (currentItemIndex < items.length) {
            gameActive = true;
            spawnLevel();
        } else {
            // Game Won
            gameActive = true; 
            floatingItem = null;
            obstacles = []; // Clear enemies
        }
    }
    window.closeModal = closeModal;

    // Drawing
    function drawGrid() {
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.15)';
        ctx.lineWidth = 1;
        gridOffset = (gridOffset + 1) % 40;
        for (let x = 0; x <= canvas.width; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = gridOffset; y <= canvas.height; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
    }

    function update() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        
        if (gameActive) {
            handleInput();

            // Draw Player
            if (player.invulnerable > 0) {
                player.invulnerable--;
                ctx.globalAlpha = 0.5; // Flicker effect
            }
            
            ctx.font = `${player.size}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = "rgba(10, 255, 0, 0.8)";
            ctx.shadowBlur = 20;
            
            // Flip emoji
            ctx.save();
            ctx.translate(player.x + player.size/2, player.y + player.size/2);
            if (player.dx < 0) ctx.scale(-1, 1);
            ctx.fillText(player.emoji, 0, 0);
            ctx.restore();
            
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;

            // Draw Obstacles
            obstacles.forEach(obs => {
                obs.x += obs.speedX;
                obs.y += obs.speedY;

                // Bounce off walls
                if (obs.x < 0 || obs.x > canvas.width) obs.speedX *= -1;
                if (obs.y < 0 || obs.y > canvas.height) obs.speedY *= -1;

                ctx.font = `${obs.size}px Arial`;
                ctx.fillText(obs.emoji, obs.x, obs.y);

                // Collision with Player
                const pCenterX = player.x + player.size / 2;
                const pCenterY = player.y + player.size / 2;
                
                const dx = pCenterX - obs.x;
                const dy = pCenterY - obs.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                const hitThreshold = (player.size / 2) + (obs.size / 2);

                if (player.invulnerable === 0 && distance < hitThreshold) {
                    // HIT!
                    player.invulnerable = 60; // Frames of safety
                    container.classList.add('shake');
                    setTimeout(() => container.classList.remove('shake'), 500);
                    
                    // Improved Knockback
                    const knockbackAngle = Math.atan2(dy, dx);
                    player.x += Math.cos(knockbackAngle) * 30;
                    player.y += Math.sin(knockbackAngle) * 30;

                    // Reset Score & Progress
                    score = 0;
                    currentItemIndex = 0;
                    document.getElementById('scoreVal').innerText = score;
                    createExplosion(player.x, player.y, '#ff0000'); 
                    spawnLevel(); // Reset to Level 1 state
                }
            });

            // Draw Item
            if (floatingItem) {
                floatingItem.angle += 0.05;
                const bobY = Math.sin(floatingItem.angle) * 10;
                
                ctx.font = `${floatingItem.size}px Arial`;
                ctx.shadowColor = floatingItem.data.color;
                ctx.shadowBlur = 30;
                ctx.fillText(floatingItem.data.emoji, floatingItem.x, floatingItem.y + bobY);
                ctx.shadowBlur = 0;

                // Item Pickup
                const dx = (player.x + player.size/2) - floatingItem.x;
                const dy = (player.y + player.size/2) - (floatingItem.y + bobY);
                const dist = Math.sqrt(dx*dx + dy*dy);

                if (dist < player.size) {
                    createExplosion(floatingItem.x, floatingItem.y, floatingItem.data.color);
                    showMessage(floatingItem.data);
                    floatingItem = null;
                }
            }
        }

        // Particles
        particles.forEach((p, index) => {
            p.update();
            p.draw();
            if (p.life <= 0) particles.splice(index, 1);
        });

        // Win Text
        if (score === items.length && !floatingItem) {
            ctx.save();
            ctx.textAlign = "center";
            
            // Rainbow Color Effect for the Birthday Message
            ctx.fillStyle = `hsl(${Date.now() / 10 % 360}, 100%, 60%)`;
            
            // Responsive font size
            const mainFontSize = Math.min(canvas.width, 500) / 15; 
            ctx.font = `${mainFontSize}px 'Press Start 2P'`;
            
            ctx.fillText("HAPPY BIRTHDAY", canvas.width/2, canvas.height/2 - 60);
            ctx.fillText("DEMILADE!", canvas.width/2, canvas.height/2 - 10);

            // Subtext
            ctx.fillStyle = "white";
            ctx.font = "12px 'Press Start 2P'";
            ctx.fillText("You are my greatest adventure.", canvas.width/2, canvas.height/2 + 40);
            
            ctx.fillStyle = "#ff00ff"; // Pink
            ctx.fillText("I love you! ❤️", canvas.width/2, canvas.height/2 + 70);
            
            ctx.restore();
            
            // Constant Fireworks
            if(Math.random() < 0.15) {
                createExplosion(Math.random()*canvas.width, Math.random()*canvas.height, '#ff00ff');
            }
        }

        requestAnimationFrame(update);
    }

    function startGame() {
        document.getElementById('start-screen').style.display = 'none';
        
        // Ensure player starts in center relative to current resize
        player.x = canvas.width / 2 - player.size / 2;
        player.y = canvas.height / 2 - player.size / 2;
        
        gameActive = true;
        spawnLevel();
        update();
    }
    
    // Initial setup
    resize();
    // Center player initially just in case
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;

    window.startGame = startGame;