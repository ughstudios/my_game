// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new THREE.PointerLockControls(camera, document.body);

// Lighting
const light = new THREE.AmbientLight(0x404040);
scene.add(light);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Floor
const floorGeometry = new THREE.PlaneGeometry(50, 50);
const floorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x333333,
    roughness: 0.8,
    metalness: 0.2
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Collision objects
const collisionObjects = [];
const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x555555,
    roughness: 0.7,
    metalness: 0.3,
    transparent: true,
    opacity: 0.8
});

// Score handling
let playerScore = 0;
function updateScoreDisplay() {
    const el = document.getElementById('score');
    if (el) el.textContent = `Score: ${playerScore}`;
}

// Create walls with collision
function createWall(x, y, z, width = 10, height = 5, depth = 1, isInvisible = false, type = 'wall') {
    // Create visual mesh
    const wallGeometry = new THREE.BoxGeometry(width, height, depth);
    const material = isInvisible 
        ? new THREE.MeshBasicMaterial({ visible: false })
        : wallMaterial;
    
    const wall = new THREE.Mesh(wallGeometry, material);
    wall.position.set(x, y, z);
    wall.castShadow = !isInvisible;
    wall.receiveShadow = !isInvisible;
    
    if (!isInvisible) {
        scene.add(wall);
    }
    
    // Create collision box that matches the wall's dimensions and position
    const box = new THREE.Box3(
        new THREE.Vector3(x - width/2, y - height/2, z - depth/2),
        new THREE.Vector3(x + width/2, y + height/2, z + depth/2)
    );
    
    // Add a small margin to prevent getting too close
    box.expandByScalar(0.2);
    
    collisionObjects.push({
        mesh: wall,
        box: box,
        position: new THREE.Vector3(x, y, z),
        width: width,
        height: height,
        depth: depth,
        type: type
    });
    
    return wall;
}

// Create a simple maze with collision
const wallPositions = [
    [10, 2.5, 0, 10, 5, 1],    // Horizontal wall at z=0
    [0, 2.5, 10, 1, 5, 10],    // Vertical wall at x=0
    [-10, 2.5, 0, 10, 5, 1],   // Horizontal wall at z=0 (negative x)
    [0, 2.5, -10, 1, 5, 10],   // Vertical wall at x=0 (negative z)
    [5, 2.5, 5, 10, 5, 0.5],   // Smaller horizontal wall at z=5
    [-5, 2.5, 5, 10, 5, 0.5],  // Smaller horizontal wall at z=5 (negative x)
    [5, 2.5, -5, 10, 5, 0.5],  // Smaller horizontal wall at z=-5
    [-5, 2.5, -5, 10, 5, 0.5]  // Smaller horizontal wall at z=-5 (negative x)
];

// Create all walls
wallPositions.forEach(pos => {
    createWall(...pos);
});

// Add boundary walls with proper collision
// Floor and ceiling (invisible but with collision)
createWall(0, 0, 0, 50, 0.1, 50, true, 'floor');
createWall(0, 10, 0, 50, 0.1, 50, true, 'ceiling');

// Boundary walls (visible)
createWall(0, 6.25, -25, 50, 12.5, 1);   // Front wall
createWall(0, 6.25, 25, 50, 12.5, 1);    // Back wall
createWall(-25, 6.25, 0, 1, 12.5, 52);   // Left wall
createWall(25, 6.25, 0, 1, 12.5, 52);    // Right wall

// Player settings and collision
const player = {
    moveSpeed: 0.15,
    jumpSpeed: 0.3,
    canJump: true,
    isJumping: false,
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    height: 1.8,
    radius: 0.5,
    position: new THREE.Vector3(0, 2, 0),
    verticalVelocity: 0,
    gravity: 0.02,
    isOnGround: true
};

// Check if a position collides with any object
function checkCollision(position, radius = player.radius, ignoreTypes = []) {
    // Create a sphere for collision checking
    const sphere = new THREE.Sphere(
        new THREE.Vector3(position.x, position.y, position.z),
        radius
    );
    
    // Check collision with all objects
    for (const obj of collisionObjects) {
        if (ignoreTypes.includes(obj.type)) continue;
        
        // Create a temporary box for collision checking
        const box = new THREE.Box3().copy(obj.box);
        
        // Check for collision
        if (box.intersectsSphere(sphere)) {
            return { collided: true, object: obj };
        }
    }
    return { collided: false };
}

// Player's gun
const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.1, 0.5),
    new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        metalness: 0.7,
        roughness: 0.3
    })
);
scene.add(gun);

// Add gun to collision objects (with a small offset to avoid self-collision)
const gunBox = new THREE.Box3().setFromObject(gun);
collisionObjects.push({
    mesh: gun,
    box: gunBox,
    type: 'player_gun'
});

// Bullets
const bullets = [];
const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const BULLET_SPEED = 0.5;

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Pointer lock controls
// Allow both mouse click and any key press to initiate pointer lock so the
// game starts even if the user begins with a keyboard interaction.
function requestPointerLock() {
    if (!document.pointerLockElement) {
        controls.lock();
    }
}

document.addEventListener('click', requestPointerLock);
document.addEventListener('keydown', requestPointerLock);

// Movement controls
const onKeyDown = (event) => {
    switch (event.code) {
        case 'KeyW': player.moveForward = true; break;
        case 'KeyA': player.moveLeft = true; break;
        case 'KeyS': player.moveBackward = true; break;
        case 'KeyD': player.moveRight = true; break;
        case 'Space': 
            if (player.isOnGround) {
                player.verticalVelocity = player.jumpSpeed;
                player.isOnGround = false;
            }
            break;
    }
};

const onKeyUp = (event) => {
    switch (event.code) {
        case 'KeyW': player.moveForward = false; break;
        case 'KeyA': player.moveLeft = false; break;
        case 'KeyS': player.moveBackward = false; break;
        case 'KeyD': player.moveRight = false; break;
    }
};

// Mouse controls
const onMouseDown = (event) => {
    if (event.button === 0) { // Left click
        shoot();
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
document.addEventListener('mousedown', onMouseDown);

// Shooting function
function shoot() {
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    
    // Position the bullet slightly in front of the camera
    const startPosition = camera.position.clone();
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    startPosition.add(direction.multiplyScalar(1));
    bullet.position.copy(startPosition);
    
    // Set bullet's velocity in the direction the camera is facing
    const velocity = direction.clone().multiplyScalar(BULLET_SPEED);
    bullet.userData.velocity = velocity;
    
    // Add bullet to scene
    scene.add(bullet);
    
    // Add bullet to collision objects
    const bulletBox = new THREE.Box3().setFromObject(bullet);
    const bulletObj = {
        mesh: bullet,
        box: bulletBox,
        type: 'bullet',
        owner: 'player',
        damage: 10,
        update: function() {
            // Update bullet's collision box
            this.box.setFromObject(this.mesh);
        }
    };
    
    collisionObjects.push(bulletObj);
    bullets.push(bulletObj);
    
    // Remove bullet after a timeout
    setTimeout(() => {
        if (bullet.parent) {
            scene.remove(bullet);
            const index = bullets.indexOf(bulletObj);
            if (index > -1) {
                bullets.splice(index, 1);
            }
            
            const collisionIndex = collisionObjects.indexOf(bulletObj);
            if (collisionIndex > -1) {
                collisionObjects.splice(collisionIndex, 1);
            }
        }
    }, 3000); // Remove after 3 seconds
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Player movement
    if (controls.isLocked) {
        const time = performance.now();
        
        // Update bullets and check for collisions
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            const newPosition = bullet.mesh.position.clone().add(bullet.mesh.userData.velocity);
            
            // Update bullet position
            bullet.mesh.position.copy(newPosition);
            bullet.update();
            
            // Check for bullet collisions
            const collision = checkCollision(newPosition, 0.2, ['bullet']);
            if (collision.collided) {
                // Handle collision based on object type
                if (collision.object.type === 'enemy' && bullet.owner === 'player') {
                    // Damage enemy
                    collision.object.health -= bullet.damage;
                    if (collision.object.health <= 0) {
                        // Remove enemy if health is 0
                        scene.remove(collision.object.mesh);
                        const enemyIndex = enemies.indexOf(collision.object.mesh);
                        if (enemyIndex > -1) {
                            enemies.splice(enemyIndex, 1);
                        }
                        const objIndex = collisionObjects.indexOf(collision.object);
                        if (objIndex > -1) {
                            collisionObjects.splice(objIndex, 1);
                        }
                        playerScore += 1;
                        updateScoreDisplay();
                    }
                }
                
                // Remove bullet on collision
                scene.remove(bullet.mesh);
                bullets.splice(i, 1);
                
                // Remove from collision objects
                const collisionIndex = collisionObjects.indexOf(bullet);
                if (collisionIndex > -1) {
                    collisionObjects.splice(collisionIndex, 1);
                }
                continue;
            }
        }
        
        // Apply gravity
        player.verticalVelocity -= player.gravity;
        
        // Check if player is on ground
        const groundSphere = new THREE.Sphere(
            new THREE.Vector3(camera.position.x, camera.position.y - player.height, camera.position.z),
            player.radius
        );

        player.isOnGround = false;
        for (const obj of collisionObjects) {
            if (obj.type === 'floor') {
                if (obj.box.intersectsSphere(groundSphere)) {
                    player.isOnGround = true;
                    if (player.verticalVelocity < 0) player.verticalVelocity = 0;
                    break;
                }
            }
        }
        
        // Update vertical position
        camera.position.y += player.verticalVelocity;
        
        // Update player position with collision detection
        const moveX = (player.moveRight ? 1 : 0) - (player.moveLeft ? 1 : 0);
        const moveZ = (player.moveForward ? 1 : 0) - (player.moveBackward ? 1 : 0);
        
        if (moveX !== 0 || moveZ !== 0) {
            // Get camera's forward and right vectors
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            
            // Zero out the y component to keep movement horizontal
            forward.y = 0;
            right.y = 0;
            forward.normalize();
            right.normalize();
            
            // Calculate movement direction based on input
            const moveDirection = new THREE.Vector3()
                .add(forward.multiplyScalar(moveZ)) // Forward/backward
                .add(right.multiplyScalar(moveX));  // Strafe left/right
            
            moveDirection.normalize();
            
            // Calculate new position
            const newPosition = new THREE.Vector3().copy(camera.position);
            newPosition.add(moveDirection.multiplyScalar(player.moveSpeed));
            
            // Check for collisions with all objects except the gun
            const collision = checkCollision(newPosition, player.radius, ['player_gun','floor','ceiling']);
            
            if (!collision.collided) {
                // No collision, move freely
                camera.position.copy(newPosition);
            } else if (collision.object.type === 'enemy') {
                // Push back from enemies
                const pushDirection = new THREE.Vector3().copy(camera.position)
                    .sub(collision.object.mesh.position)
                    .normalize()
                    .multiplyScalar(0.1);
                camera.position.add(pushDirection);
            } else {
                // Try moving just along X axis (strafing)
                const xMove = new THREE.Vector3(moveDirection.x, 0, 0);
                const xPosition = new THREE.Vector3().copy(camera.position).add(xMove.multiplyScalar(player.moveSpeed));
                
                if (!checkCollision(xPosition, player.radius, ['player_gun','floor','ceiling']).collided) {
                    camera.position.copy(xPosition);
                } else {
                    // Try moving just along Z axis (forward/back)
                    const zMove = new THREE.Vector3(0, 0, moveDirection.z);
                    const zPosition = new THREE.Vector3().copy(camera.position).add(zMove.multiplyScalar(player.moveSpeed));
                    
                    if (!checkCollision(zPosition, player.radius, ['player_gun','floor','ceiling']).collided) {
                        camera.position.copy(zPosition);
                    }
                }
            }
        }
        
        // Keep player from going below ground or above ceiling
        if (camera.position.y < 1.8) {
            camera.position.y = 1.8;
            player.verticalVelocity = 0;
            player.isOnGround = true;
        } else if (camera.position.y > 10) {
            camera.position.y = 10;
            player.verticalVelocity = 0;
        }
    }
    
    // Update gun position to follow camera (positioned at bottom right of screen)
    const direction = new THREE.Vector3(0.3, -0.4, -0.5);
    direction.applyQuaternion(camera.quaternion);
    gun.position.copy(camera.position).add(direction);
    gun.quaternion.copy(camera.quaternion);
    
    renderer.render(scene, camera);
}

// Start animation loop
camera.position.y = player.height;
animate();

// Enemies array
const enemies = [];

// Add some enemies with collision
for (let i = 0; i < 5; i++) {
    const enemy = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 1),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
    );
    
    // Position enemies in valid locations
    let validPosition = false;
    let position;
    let attempts = 0;
    
    while (!validPosition && attempts < 50) {
        position = new THREE.Vector3(
            (Math.random() * 40) - 20,  // -20 to 20
            1,
            (Math.random() * 40) - 20   // -20 to 20
        );
        
        // Check if position is valid (not inside walls or other objects)
        const collision = checkCollision(position, 1.5, ['enemy']);
        if (!collision.collided) {
            validPosition = true;
            enemy.position.copy(position);
            
            // Add collision box for enemy
            const enemyBox = new THREE.Box3().setFromObject(enemy);
            enemyBox.expandByScalar(0.2); // Add some margin
            
            collisionObjects.push({
                mesh: enemy,
                box: enemyBox,
                type: 'enemy',
                health: 100,
                update: function() {
                    // Update enemy's collision box position
                    this.box.setFromObject(this.mesh);
                    this.box.expandByScalar(0.2);
                }
            });
            
            enemies.push(enemy);
            scene.add(enemy);
        }
        attempts++;
    }
}

// score submission handler
updateScoreDisplay();
const saveButton = document.getElementById('save-score');
if (saveButton) {
    saveButton.addEventListener('click', async () => {
        const input = document.getElementById('player-name');
        const name = input.value.trim();
        if (!name) return;
        try {
            await fetch('/api/scores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, score: playerScore })
            });
        } catch (e) {
            console.error('Failed to submit score', e);
        }
        input.value = '';
    });
}
