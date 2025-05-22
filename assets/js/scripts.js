 // A-Frame component to handle finding items
        AFRAME.registerComponent('found-item', {
            init: function () {
                this.found = false;
                this.el.addEventListener('click', () => {
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

        document.addEventListener('DOMContentLoaded', () => {
            const arContainer = document.getElementById('ar-container');
            const fallbackContainer = document.getElementById('fallback-container');
            const fallbackTextOverlay = document.getElementById('fallback-text-overlay');
            const arInstructions = document.getElementById('ar-instructions');
            const arScene = document.querySelector('#ar-container a-scene'); // Specific AR scene
            const ispyScene = document.getElementById('ispy-scene'); // Specific I Spy scene
            const ispyUI = document.getElementById('ispy-ui');
            const tapsCountSpan = document.getElementById('taps-count');
            const foundCountSpan = document.getElementById('found-count');

            let totalTaps = 0;
            let foundItems = 0;
            const totalItems = document.querySelectorAll('.ispy-item').length; // Count items with 'ispy-item' class

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
                        // No need to call configureIspyCameraControls() anymore, camera is fixed in HTML
                    });
                }
                console.warn(message);
            };

            // Function to show AR container
            const showAR = () => {
                arContainer.style.display = 'block';
                fallbackContainer.style.display = 'none';
                arInstructions.style.display = 'block';
                console.log("AR container displayed.");
            };

            // I Spy game logic
            ispyScene.addEventListener('item-found', (event) => {
                foundItems++;
                foundCountSpan.textContent = foundItems;
                console.log(`Item found: ${event.detail.id}. Total found: ${foundItems}`);

                if (foundItems === totalItems) {
                    alert('Congratulations! You found all the items!');
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