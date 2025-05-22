// Reusable A-Frame component to handle finding items
        AFRAME.registerComponent('found-item', {
            init: function () {
                this.found = false;
                this.el.addEventListener('click', (evt) => {
                    // Prevent clicks from propagating to the scene if an item is found
                    evt.stopPropagation();

                    if (!this.found) {
                        this.found = true;
                        this.el.setAttribute('material', 'color', '#888888'); // Change color when found
                        this.el.setAttribute('animation__scale', {
                            property: 'scale',
                            to: '0 0 0', // Shrink to nothing
                            dur: 300,
                            easing: 'easeOutQuad'
                        });
                        this.el.setAttribute('animation__rotate', {
                            property: 'rotation',
                            to: '0 360 0', // Spin while shrinking
                            dur: 300,
                            easing: 'easeOutQuad'
                        });

                        // Emit a custom event to the scene to update game state
                        const sceneEl = this.el.sceneEl;
                        sceneEl.emit('item-found', { id: this.el.id });
                    }
                });
            }
        });

        // A-Frame component for AR object placement and game management
        AFRAME.registerComponent('ar-placement-manager', {
            schema: {
                // Define the items to be placed in AR
                itemsToPlace: {
                    default: [
                        { primitive: 'box', color: '#FF0000', scale: '0.2 0.2 0.2' },
                        { primitive: 'sphere', color: '#00FF00', scale: '0.3 0.3 0.3' },
                        { primitive: 'cylinder', color: '#0000FF', scale: '0.15 0.15 0.15' },
                        { primitive: 'cone', color: '#FFFF00', scale: '0.4 0.4 0.4' },
                        { primitive: 'dodecahedron', color: '#FF00FF', scale: '0.25 0.25 0.25' }
                    ],
                    // A-Frame's schema parser can handle JSON strings for complex objects
                    parse: JSON.parse,
                    stringify: JSON.stringify
                },
                placementRadius: { type: 'number', default: 1.5 }, // Max distance from initial tap point
                minItemDistance: { type: 'number', default: 0.5 } // Min distance between items
            },

            init: function () {
                this.scene = this.el;
                this.camera = this.scene.querySelector('a-entity[camera]');
                this.reticle = document.getElementById('reticle');
                this.arGameUI = document.getElementById('ar-game-ui');
                this.arFoundCountSpan = document.getElementById('ar-found-count');
                this.arTotalItemsSpan = document.getElementById('ar-total-items');
                this.arGameMessage = document.getElementById('ar-game-message');

                this.itemsPlaced = false;
                this.foundItemsCount = 0;
                this.placedEntities = []; // Store references to placed entities

                // Bind event handlers
                this.onSessionStart = this.onSessionStart.bind(this);
                this.onSessionEnd = this.onSessionEnd.bind(this);
                this.onARClick = this.onARClick.bind(this);
                this.onItemFound = this.onItemFound.bind(this);

                // Add event listeners to the scene
                this.scene.addEventListener('webxr-session-start', this.onSessionStart);
                this.scene.addEventListener('webxr-session-end', this.onSessionEnd);
                this.scene.addEventListener('click', this.onARClick);
                this.scene.addEventListener('item-found', this.onItemFound);

                // Update total items display in AR UI
                this.arTotalItemsSpan.textContent = this.data.itemsToPlace.length;
            },

            onSessionStart: function () {
                console.log('AR Session Started. Initializing placement manager.');
                this.reticle.setAttribute('visible', true);
                this.arGameUI.style.display = 'block';
                this.arGameMessage.textContent = 'Look around and tap to place items!';
                this.itemsPlaced = false;
                this.foundItemsCount = 0;
                this.arFoundCountSpan.textContent = this.foundItemsCount;

                // Clear any previously placed items if session restarts
                this.placedEntities.forEach(el => el.parentNode.removeChild(el));
                this.placedEntities = [];
            },

            onSessionEnd: function () {
                console.log('AR Session Ended. Hiding reticle and UI.');
                this.reticle.setAttribute('visible', false);
                this.arGameUI.style.display = 'none';
                // Remove placed items when session ends
                this.placedEntities.forEach(el => el.parentNode.removeChild(el));
                this.placedEntities = [];
            },

            tick: function () {
                // Update reticle position if items haven't been placed yet and in AR mode
                if (!this.itemsPlaced && this.scene.is('ar-mode')) {
                    const webxrCamera = this.scene.camera.el.getObject3D('camera');
                    if (webxrCamera && webxrCamera.matrixWorld) {
                        const hitTestState = this.scene.components.webxr.hitTestState;
                        if (hitTestState && hitTestState.results.length > 0) {
                            const hit = hitTestState.results[0];
                            // Get the pose relative to the scene's reference space
                            const pose = hit.getPose(this.scene.renderer.xr.getReferenceSpace());
                            if (pose) {
                                this.reticle.object3D.position.copy(pose.transform.position);
                                this.reticle.object3D.quaternion.copy(pose.transform.orientation);
                                this.reticle.setAttribute('visible', true);
                            }
                        } else {
                            this.reticle.setAttribute('visible', false);
                        }
                    }
                }
            },

            onARClick: function (evt) {
                if (!this.scene.is('ar-mode')) return; // Only process clicks in AR mode

                if (!this.itemsPlaced) {
                    // First click: place all items
                    const hitTestState = this.scene.components.webxr.hitTestState;
                    if (hitTestState && hitTestState.results.length > 0) {
                        const hit = hitTestState.results[0];
                        const pose = hit.getPose(this.scene.renderer.xr.getReferenceSpace());

                        if (pose) {
                            const initialPlacementPoint = new THREE.Vector3().copy(pose.transform.position);
                            this.placeAllItems(initialPlacementPoint);
                            this.itemsPlaced = true;
                            this.reticle.setAttribute('visible', false);
                            this.arGameMessage.textContent = 'Find the hidden objects!';
                        }
                    }
                }
                // Subsequent clicks are handled by the 'found-item' component
            },

            placeAllItems: function (initialPlacementPoint) {
                const items = this.data.itemsToPlace;
                const placementRadius = this.data.placementRadius;
                const minItemDistance = this.data.minItemDistance;
                const placedPositions = [];

                // Ensure THREE is available (A-Frame makes it globally available)
                if (typeof THREE === 'undefined') {
                    console.error("THREE.js not found. Cannot place items.");
                    return;
                }

                items.forEach((itemDef, index) => {
                    let placed = false;
                    let attempts = 0;
                    const maxAttempts = 50; // Prevent infinite loop if no good spots are found

                    while (!placed && attempts < maxAttempts) {
                        attempts++;

                        // Generate a random position within the radius
                        // Use a random angle and distance from the initial point
                        const angle = Math.random() * Math.PI * 2; // 0 to 360 degrees
                        const distance = Math.random() * placementRadius; // 0 to placementRadius
                        const x = initialPlacementPoint.x + Math.cos(angle) * distance;
                        const z = initialPlacementPoint.z + Math.sin(angle) * distance;
                        const y = initialPlacementPoint.y; // Assume placing on the same plane height as the initial tap

                        const newPosition = new THREE.Vector3(x, y, z);

                        // Check minimum distance from other placed items
                        let tooClose = false;
                        for (let i = 0; i < placedPositions.length; i++) {
                            if (newPosition.distanceTo(placedPositions[i]) < minItemDistance) {
                                tooClose = true;
                                break;
                            }
                        }

                        if (!tooClose) {
                            // Create the entity
                            const entity = document.createElement('a-entity');
                            entity.setAttribute('id', `ar-item-${index}`);
                            entity.setAttribute('position', `${newPosition.x} ${newPosition.y} ${newPosition.z}`);
                            entity.setAttribute('class', 'ar-item'); // For general selection
                            entity.setAttribute('found-item', ''); // Attach our reusable component

                            // Set primitive and other attributes from itemDef
                            if (itemDef.primitive) {
                                entity.setAttribute('geometry', `primitive: ${itemDef.primitive}`);
                            }
                            if (itemDef.color) {
                                entity.setAttribute('material', `color: ${itemDef.color}`);
                            }
                            if (itemDef.scale) {
                                entity.setAttribute('scale', itemDef.scale);
                            }
                            if (itemDef.rotation) {
                                entity.setAttribute('rotation', itemDef.rotation);
                            }

                            this.scene.appendChild(entity);
                            this.placedEntities.push(entity);
                            placedPositions.push(newPosition);
                            placed = true;
                            console.log(`Placed item ${index} at ${newPosition.x.toFixed(2)}, ${newPosition.y.toFixed(2)}, ${newPosition.z.toFixed(2)}`);
                        }
                    }

                    if (!placed) {
                        console.warn(`Could not place item ${index} after ${maxAttempts} attempts. Consider adjusting placementRadius or minItemDistance.`);
                    }
                });
            },

            onItemFound: function (event) {
                this.foundItemsCount++;
                this.arFoundCountSpan.textContent = this.foundItemsCount;
                console.log(`AR Item found: ${event.detail.id}. Total found: ${this.foundItemsCount}`);

                if (this.foundItemsCount === this.data.itemsToPlace.length) {
                    this.arGameMessage.textContent = 'Congratulations! You found all the items!';
                    alert('Congratulations! You found all the AR items!');
                    // Optionally reset game or show a completion message
                }
            },

            remove: function () {
                // Clean up event listeners when the component is removed
                this.scene.removeEventListener('webxr-session-start', this.onSessionStart);
                this.scene.removeEventListener('webxr-session-end', this.onSessionEnd);
                this.scene.removeEventListener('click', this.onARClick);
                this.scene.removeEventListener('item-found', this.onItemFound);
            }
        });

        document.addEventListener('DOMContentLoaded', () => {
            const arContainer = document.getElementById('ar-container');
            const fallbackContainer = document.getElementById('fallback-container');
            const fallbackTextOverlay = document.getElementById('fallback-text-overlay');
            const arInstructions = document.getElementById('ar-instructions');
            const arScene = document.querySelector('#ar-container a-scene'); // Specific AR scene
            const ispyScene = document.getElementById('ispy-scene'); // Specific I Spy scene
            const ispyUI = document.getElementById('ispy-ui');
            const ispyFoundCountSpan = document.getElementById('ispy-found-count');
            const ispyTotalItemsSpan = document.getElementById('ispy-total-items');

            // Set total items for I Spy UI
            ispyTotalItemsSpan.textContent = document.querySelectorAll('.ispy-item').length;

            let ispyFoundItems = 0;

            // Helper to detect iOS devices
            function isIOS() {
                return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            }

            // Function to show fallback with specific message and "Play I Spy" button
            const showFallback = (message, isIOSSpecific = false) => {
                arContainer.style.display = 'none';
                fallbackContainer.style.display = 'block'; // Show the fallback container
                arInstructions.style.display = 'none';

                let fallbackHTML = `<h1>AR Not Supported</h1>`;

                if (isIOSSpecific) {
                    fallbackHTML += `
                        <p>It looks like you're on an iPhone or iPad. To enable Augmented Reality, you need to enable an experimental feature in Safari settings.</p>
                        <p>Please follow these steps:</p>
                        <ol>
                            <li>Go to your iPhone/iPad's <strong>Settings</strong> app.</li>
                            <li>Scroll down and tap on <strong>Safari</strong>.</li>
                            <li>Scroll down and tap on <strong>Advanced</strong>.</li>
                            <li>Tap on <strong>Feature Flags</strong>.</li>
                            <li>Scroll down and enable <strong>WebXR Augmented Reality Module</strong> (toggle it ON).</li>
                            <li><strong>Important:</strong> Close Safari completely (swipe up from app switcher) and reopen it.</li>
                            <li>Return to this page.</li>
                        </ol>
                        <p>If you've done this and it still doesn't work, ensure your iOS is up to date (iOS 13+ required).</p>
                        <button id="start-ispy-game" style="padding: 10px 20px; font-size: 1.2em; margin-top: 20px; cursor: pointer;">Play "I Spy" Instead</button>
                    `;
                } else {
                    fallbackHTML += `
                        <p>Unfortunately, your device or browser does not support WebXR Augmented Reality.</p>
                        <p>To experience this scavenger hunt, please try on a modern smartphone (Android or iOS) with a WebXR-compatible browser (e.g., Chrome, Firefox, Safari).</p>
                        <p>Remember to visit this page over <strong>HTTPS</strong>.</p>
                        <button id="start-ispy-game" style="padding: 10px 20px; font-size: 1.2em; margin-top: 20px; cursor: pointer;">Play "I Spy" Instead</button>
                    `;
                }
                fallbackTextOverlay.innerHTML = fallbackHTML;
                fallbackTextOverlay.style.display = 'flex'; // Show the overlay

                // Add event listener for the "Play I Spy" button
                const startIspyButton = document.getElementById('start-ispy-game');
                if (startIspyButton) {
                    startIspyButton.addEventListener('click', () => {
                        fallbackTextOverlay.style.display = 'none'; // Hide the overlay
                        ispyUI.style.display = 'block'; // Show the I Spy game UI
                        ispyScene.play(); // Start the I Spy scene
                    });
                }
                console.warn(message);
            };

            // Function to show AR container
            const showAR = () => {
                arContainer.style.display = 'block';
                fallbackContainer.style.display = 'none';
                arInstructions.style.display = 'block';
                // AR game UI will be managed by ar-placement-manager
                console.log("AR container displayed.");
            };

            // I Spy game logic
            ispyScene.addEventListener('item-found', (event) => {
                ispyFoundItems++;
                ispyFoundCountSpan.textContent = ispyFoundItems;
                console.log(`I Spy Item found: ${event.detail.id}. Total found: ${ispyFoundItems}`);

                if (ispyFoundItems === parseInt(ispyTotalItemsSpan.textContent)) {
                    alert('Congratulations! You found all the I Spy items!');
                    // Optionally reset game or show a completion message
                }
            });

            // Initial check for AR support
            if (navigator.xr) {
                if (typeof navigator.xr.isSessionSupported === 'function') {
                    navigator.xr.isSessionSupported('immersive-ar')
                        .then((supported) => {
                            if (supported) {
                                showAR();
                                console.log("WebXR 'immersive-ar' session is supported via isSessionSupported.");
                            } else {
                                if (isIOS()) {
                                    showFallback("WebXR 'immersive-ar' session is NOT supported on this iOS device. Likely Feature Flag issue.", true);
                                } else {
                                    showFallback("WebXR 'immersive-ar' session is NOT supported on this device via isSessionSupported.");
                                }
                            }
                        })
                        .catch((error) => {
                            console.error("Error checking WebXR support with isSessionSupported:", error);
                            showFallback(`Error checking AR support: ${error.message}`);
                        });
                } else {
                    // Fallback for browsers without isSessionSupported (e.g., Firefox)
                    showAR(); // Initially show AR container, A-Frame will decide if button appears
                    console.warn("navigator.xr.isSessionSupported not found. Relying on A-Frame's internal checks.");

                    arScene.addEventListener('webxr-ready', () => {
                        setTimeout(() => {
                            const arButton = document.querySelector('.a-enter-vr-button[data-mode="ar"]');
                            if (!arButton) {
                                showFallback("A-Frame 'Enter AR' button did not appear. AR is likely not supported or accessible.");
                            } else {
                                console.log("A-Frame 'Enter AR' button found. AR is likely supported.");
                            }
                        }, 100);
                    });

                    const arInitTimeout = setTimeout(() => {
                        const arButton = document.querySelector('.a-enter-vr-button[data-mode="ar"]');
                        if (arContainer.style.display === 'block' && !arButton) {
                            showFallback("A-Frame AR initialization timed out or failed to show button.");
                        }
                    }, 5000);

                    arScene.addEventListener('webxr-ready', () => clearTimeout(arInitTimeout));
                }
            } else {
                // WebXR API not found at all
                showFallback("WebXR API (navigator.xr) not found in this browser.");
            }

            // Initially pause the I Spy scene until the user explicitly starts it
            ispyScene.pause();
        });