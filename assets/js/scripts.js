import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
document.addEventListener('DOMContentLoaded', () => {
    console.log("Main scripts.js loaded and DOMContentLoaded fired.");
    console.log("THREE object:", THREE);
    console.log("GLTFLoader object:", GLTFLoader); // This should now be a function

    // UI Elements
    const instructionsContainer = document.getElementById('instructions-container');
    const instructionsTextOverlay = document.getElementById('instructions-text-overlay');
    const ispyUI = document.getElementById('ispy-ui');
    const ispyFoundCountSpan = document.getElementById('ispy-found-count');
    const ispyTotalItemsSpan = document.getElementById('ispy-total-items');
    const canvas = document.getElementById('three-canvas');

    // Three.js Scene Setup
    let scene, camera, renderer, raycaster, mouse;
    let ispyItems = []; // Array to hold our 3D objects
    let totalIspyItems = 0;
    let ispyFoundItems = 0;
    let isGameRunning = false; // Control animation loop

    // Function to initialize the Three.js scene
    const initThreeScene = async () => {
        // Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xFFFFFF);

        // Camera
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(8, 10, 8);
        camera.rotation.order = 'YXZ'; // Important for setting rotations correctly
        camera.rotation.y = THREE.MathUtils.degToRad(45);
        camera.rotation.x = THREE.MathUtils.degToRad(-30);

        // Renderer
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0xEEEEEE); // Light grey background
        
        // Lights
        const ambientLight = new THREE.AmbientLight(0xBBBBBB); // color #BBB
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 0.6); // color #FFF, intensity 0.6
        directionalLight.position.set(-1, 1, 1).normalize();
        scene.add(directionalLight);

        // Raycaster for interactions
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        // Load Models
        const loader = new GLTFLoader(); // Use GLTFLoader directly, as it's imported

        const modelsToLoad = [
            { id: "ispy-item1", path: "./assets/3d/cube.glb", position: new THREE.Vector3(-1, 0.5, -2), scale: 0.3, color: 0xFF0000 },
            { id: "ispy-item2", path: "./assets/3d/cone.glb", position: new THREE.Vector3(1, 0.7, -3), scale: 0.4, color: 0x00FF00 },
            { id: "ispy-item3", path: "./assets/3d/cylinder.glb", position: new THREE.Vector3(0, 0.3, -1), scale: 0.2, color: 0x0000FF },
            { id: "ispy-item4", path: "./assets/3d/sphere.glb", position: new THREE.Vector3(-2, 0.8, 0), scale: 0.5, color: 0xFFFF00 }
        ];

        totalIspyItems = modelsToLoad.length;
        ispyTotalItemsSpan.textContent = totalIspyItems;

        const loadPromises = modelsToLoad.map(item => {
            return new Promise((resolve, reject) => {
                loader.load(item.path, (gltf) => {
                    const model = gltf.scene;

                    // Apply position, scale, and color
                    model.position.copy(item.position);
                    model.scale.set(item.scale, item.scale, item.scale);

                    // Traverse the model to find mesh and apply material/color
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.material = new THREE.MeshStandardMaterial({ color: item.color });
                            child.material.metalness = 0; // Ensure basic material properties for consistency
                            child.material.roughness = 1;
                        }
                    });

                    // Store game-specific data on the model's userData
                    model.userData = {
                        id: item.id,
                        found: false,
                        initialColor: item.color
                    };

                    scene.add(model);
                    ispyItems.push(model); // Add to our interactable items list
                    resolve(model);
                }, undefined, (error) => {
                    console.error(`Error loading GLTF model ${item.path}:`, error);
                    reject(error);
                });
            });
        });

        await Promise.all(loadPromises); // Wait for all models to load

        // Event Listeners for interaction
        canvas.addEventListener('click', onCanvasClick);
        window.addEventListener('resize', onWindowResize);

        // Initial render
        renderer.render(scene, camera);
        animate(); // Start the animation loop (will be paused until game starts)
    };

    // Animation Loop
    let animationFrameId;
    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        if (isGameRunning) {
            renderer.render(scene, camera);
        }
    };

    // Handle Window Resizes
    const onWindowResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };

    // Handle clicks on the canvas for object interaction
    const onCanvasClick = (event) => {
        if (!isGameRunning) return; // Don't allow clicks if game is not running

        // Calculate mouse position in normalized device coordinates (-1 to +1)
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Update the raycaster with the camera and mouse position
        raycaster.setFromCamera(mouse, camera);

        // Calculate objects intersecting the raycaster
        const intersects = raycaster.intersectObjects(ispyItems, true); // true for recursive check

        if (intersects.length > 0) {
            // Find the closest parent that is an I Spy item
            let intersectedObject = null;
            for (let i = 0; i < intersects.length; i++) {
                let current = intersects[i].object;
                // Traverse up the parent chain to find the top-level model (the one with userData.id)
                while (current) {
                    if (current.userData && current.userData.id) {
                        intersectedObject = current;
                        break;
                    }
                    current = current.parent;
                }
                if (intersectedObject) break; // Found the main object
            }


            if (intersectedObject && !intersectedObject.userData.found) {
                // Mark as found
                intersectedObject.userData.found = true;

                // Change color
                intersectedObject.traverse((child) => {
                    if (child.isMesh) {
                        child.material.color.set(0x888888); // Grey out
                    }
                });

                // Store a reference to the object for the onComplete callback
                const objectToRemove = intersectedObject;

                // Animations (GSAP)
                gsap.to(objectToRemove.scale, {
                    x: 0, y: 0, z: 0,
                    duration: 0.3,
                    ease: "power2.out"
                });
                gsap.to(objectToRemove.rotation, {
                    property: 'rotation',
                    y: objectToRemove.rotation.y + Math.PI * 2, // Spin 360 degrees
                    duration: 0.3,
                    ease: "power2.out",
                    onComplete: () => {
                        // Remove the object from the scene after animation
                        scene.remove(objectToRemove);
                        // Also remove it from the raycaster's intersectable objects array
                        ispyItems = ispyItems.filter(item => item.uuid !== objectToRemove.uuid);

                        // Update UI and game state after the animation completes
                        ispyFoundItems++;
                        ispyFoundCountSpan.textContent = ispyFoundItems;
                        console.log(`I Spy Item found: ${objectToRemove.userData.id}. Total found: ${ispyFoundItems}`);

                        if (ispyFoundItems === totalIspyItems) {
                            // Now show the alert, after the animation has finished
                            alert('Congratulations! You found all the I Spy items!');
                            isGameRunning = false; // Stop the game
                            // Optionally reset game or show a completion message
                        }
                    }
                });
            }
        }
    };


    // Function to show instructions with "Begin the Hunt" button
    const showInstructions = () => {
        instructionsContainer.style.display = 'block'; // Show the instructions container

        let instructionsHTML = `<h1>I spy with my little eye…</h1>
        <p>In this 'I Spy' game, your goal is to find all the hidden 3D objects in the virtual environment.</p>
        <div class="btn-container">
            <button id="start-ispy-game">Begin the Hunt</button>
            <button id="skip-to-projects">Skip to projects</button>
        </div>`;
        instructionsTextOverlay.innerHTML = instructionsHTML;
        instructionsTextOverlay.style.display = 'flex'; // Show the overlay

        // Add event listeners for the "Play I Spy" button
        const startIspyButton = document.getElementById('start-ispy-game');
        const skipToProjectsButton = document.getElementById('skip-to-projects');

        if (startIspyButton) {
            startIspyButton.addEventListener('click', () => {
                instructionsTextOverlay.style.display = 'none'; // Hide the overlay
                ispyUI.style.display = 'block'; // Show the I Spy game UI
                isGameRunning = true; // Start the animation loop
                console.log("I Spy Game Started!");
            });
        }
        if (skipToProjectsButton) {
            skipToProjectsButton.addEventListener('click', () => {
                alert("Skipping to projects! (This would typically navigate to another section/page)");
                // Implement navigation logic here if you have other sections.
                instructionsTextOverlay.style.display = 'none'; // Hide the overlay
                instructionsContainer.style.display = 'none'; // Hide the main container
                // Potentially stop the Three.js rendering if not needed for projects
                isGameRunning = false;
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }
            });
        }
    };


    // Initialize the Three.js scene and then show instructions
    initThreeScene().then(() => {
        showInstructions();
    }).catch(error => {
        console.error("Failed to initialize Three.js scene:", error);
        alert("Failed to load game assets. Please try again.");
    });
});