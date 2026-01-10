/* --- GAME ENGINE --- */
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('game-container');
    
    let gameActive = false;
    let score = 0;

    // Resizing
    function resize() {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }
    window.addEventListener('resize', resize);
    
    // Game Objects
    const player = {
        x: 0,
        y: 0,
        size: 28, // Smaller player size
        speed: 5,
        dx: 0,
        dy: 0,
        emoji: "😎",
        invulnerable: 0
    };

    // Data: Items + Corresponding Player Face
    const items = [
        { emoji: "🍕", playerFace: "😋", text: "You have the best taste in food (and girlfriends).", title: "PIZZA POWER!", color: "#FF9F1C" },
        { emoji: "💡", playerFace: "🤔", text: "Your ideas always inspire me.", title: "BIG BRAIN ENERGY", color: "#FFE66D" },
        { emoji: "🎵", playerFace: "🕺", text: "You bring rhythm and joy to my life.", title: "VIBE CHECK PASSED", color: "#00f3ff" },
        { emoji: "💪", playerFace: "😤", text: "I admire your strength and hustle.", title: "GRIND MODE", color: "#ff00ff" },
        { emoji: "❤️", playerFace: "😍", text: "FINAL REWARD: Demilade, you are my favorite person. I love you!", title: "QUEST COMPLETE", color: "#ff0000" }
    ];

    let currentItemIndex = 0;
    let floatingItem = null;
    let particles = [];
    let obstacles = [];
    let gridOffset = 0;
    let gameOverState = false;

    // Input Handling
    const keys = {};
    window.addEventListener('keydown', (e) => keys[e.key] = true);
    window.addEventListener('keyup', (e) => keys[e.key] = false);

    // Improved Mobile Input Logic (Stack-based)
    const heldDirections = []; 

    function setupMobileBtn(id, dir) {
        const btn = document.getElementById(id);
        
        const start = (e) => { 
            e.preventDefault(); 
            if (!heldDirections.includes(dir)) {
                heldDirections.push(dir);
            }
            btn.classList.add('active');
        };
        
        const end = (e) => { 
            e.preventDefault(); 
            const index = heldDirections.indexOf(dir);
            if (index > -1) {
                heldDirections.splice(index, 1);
            }
            btn.classList.remove('active');
        };
        
        btn.addEventListener('touchstart', start, {passive: false});
        btn.addEventListener('touchend', end, {passive: false});
        btn.addEventListener('touchcancel', end, {passive: false});
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

        // Touch (Priority to the last pressed button in the stack)
        const touchDir = heldDirections.length > 0 ? heldDirections[heldDirections.length - 1] : null;

        if (touchDir === 'up') player.dy = -player.speed;
        if (touchDir === 'down') player.dy = player.speed;
        if (touchDir === 'left') player.dx = -player.speed;
        if (touchDir === 'right') player.dx = player.speed;

        // Boundary Check & Movement
        if (player.x + player.dx > 0 && player.x + player.size + player.dx < canvas.width) player.x += player.dx;
        if (player.y + player.dy > 0 && player.y + player.size + player.dy < canvas.height) player.y += player.dy;
    }

    // Spawn Logic
    function spawnLevel() {
        if (currentItemIndex >= items.length) return; 

        player.emoji = items[currentItemIndex].playerFace;
        
        // Spawn Item with Distance Check
        let validSpawn = false;
        let attempts = 0;
        const minDistance = Math.min(canvas.width, canvas.height) * 0.6; 

        while (!validSpawn && attempts < 20) {
            const testX = Math.random() * (canvas.width - 60) + 30;
            const testY = Math.random() * (canvas.height - 60) + 30;
            const dx = testX - player.x;
            const dy = testY - player.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            if (distance > minDistance) {
                floatingItem = { x: testX, y: testY, size: 35, angle: 0, data: items[currentItemIndex] };
                validSpawn = true;
            }
            attempts++;
        }
        if (!validSpawn) {
            floatingItem = { x: Math.random() * (canvas.width - 60) + 30, y: Math.random() * (canvas.height - 60) + 30, size: 35, angle: 0, data: items[currentItemIndex] };
        }

        // Spawn Obstacles with Safety Zone
        obstacles = [];
        let obstacleCount = currentItemIndex + 3; 
        if (currentItemIndex === items.length - 1) obstacleCount = 10;

        for(let i=0; i<obstacleCount; i++) {
            let validObs = false;
            let obsX, obsY;
            let obsAttempts = 0;

            // Attempt to find a spawn point far from player
            while(!validObs && obsAttempts < 15) {
                obsX = Math.random() * canvas.width;
                obsY = Math.random() * canvas.height;
                
                // Calculate distance to player
                const dx = obsX - (player.x + player.size/2);
                const dy = obsY - (player.y + player.size/2);
                const distToPlayer = Math.sqrt(dx*dx + dy*dy);

                // Safe radius of 200px
                if (distToPlayer > 200) {
                    validObs = true;
                }
                obsAttempts++;
            }
            
            // Fallback
            if (!validObs) {
                 obsX = (player.x + 300) % canvas.width; 
                 obsY = (player.y + 300) % canvas.height;
            }

            obstacles.push({
                x: obsX,
                y: obsY,
                size: 30,
                speedX: (Math.random() - 0.5) * 4,
                speedY: (Math.random() - 0.5) * 4,
                emoji: "👾"
            });
        }
    }

    // Improved Physics Particle System
    class Particle {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            // Circular burst physics
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            
            this.color = color;
            this.alpha = 1;
            this.decay = Math.random() * 0.015 + 0.01;
            this.gravity = 0.15; // Gravity strength
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += this.gravity; // Apply gravity
            this.vx *= 0.95; // Air resistance
            this.alpha -= this.decay;
        }
        draw() {
            ctx.save();
            ctx.globalAlpha = Math.max(0, this.alpha);
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function createExplosion(x, y, color) {
        // More particles for bigger boom
        for (let i = 0; i < 40; i++) {
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
            gameOverState = true;
            gameActive = false;
            floatingItem = null;
            document.getElementById('final-screen').style.display = 'flex';
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
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            particles[i].draw();
            if (particles[i].alpha <= 0) particles.splice(i, 1);
        }

        // Background Fireworks for Final Screen
        if (gameOverState) {
            if(Math.random() < 0.2) { /* Increased frequency for better effect */
                createExplosion(Math.random()*canvas.width, Math.random()*canvas.height, `hsl(${Math.random()*360}, 100%, 50%)`);
            }
        }
        
        requestAnimationFrame(update);
    }

    function startGame() {
        document.getElementById('start-screen').style.display = 'none';
        player.x = canvas.width / 2 - player.size / 2;
        player.y = canvas.height / 2 - player.size / 2;
        gameActive = true;
        spawnLevel();
        update();
    }
    
    resize();
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    window.startGame = startGame;