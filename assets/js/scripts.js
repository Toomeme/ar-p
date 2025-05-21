        document.addEventListener('DOMContentLoaded', () => {
            const arContainer = document.getElementById('ar-container');
            const fallbackContainer = document.getElementById('fallback-container');
            const arInstructions = document.getElementById('ar-instructions');
            const scene = document.querySelector('a-scene');

            // Function to show fallback
            const showFallback = (message = "AR Not Supported") => {
                arContainer.style.display = 'none';
                fallbackContainer.style.display = 'flex';
                arInstructions.style.display = 'none';
                console.warn(message);
            };

            // Function to show AR container
            const showAR = () => {
                arContainer.style.display = 'block';
                fallbackContainer.style.display = 'none';
                arInstructions.style.display = 'block';
                console.log("AR container displayed.");
            };

            if (navigator.xr) {
                // Use isSessionSupported if available
                if (typeof navigator.xr.isSessionSupported === 'function') {
                    navigator.xr.isSessionSupported('immersive-ar')
                        .then((supported) => {
                            if (supported) {
                                showAR();
                                console.log("WebXR 'immersive-ar' session is supported via isSessionSupported.");
                            } else {
                                showFallback("WebXR 'immersive-ar' session is NOT supported on this device via isSessionSupported.");
                            }
                        })
                        .catch((error) => {
                            console.error("Error checking WebXR support with isSessionSupported:", error);
                            showFallback(`Error checking AR support: ${error.message}`);
                        });
                }
                // Fallback for browsers without isSessionSupported (Firefox)
                else {
                    // Assume AR might be supported and show the A-Frame scene. A-Frame's ar-mode-ui will then decide whether to show the button.
                    showAR();
                    console.warn("navigator.xr.isSessionSupported not found. Relying on A-Frame's internal checks.");

                    // This event fires when A-Frame has initialized its WebXR components and determined if an AR session can be requested.
                    scene.addEventListener('webxr-ready', () => {
                        // Give A-Frame a very short moment to render the button if it can. The button is usually rendered synchronously with webxr-ready, but a tiny timeout can prevent race conditions on slower devices.
                        setTimeout(() => {
                            // Check if the A-Frame "Enter AR" button exists in the DOM. A-Frame's AR button has the class 'a-enter-vr-button' and data-mode="ar"
                            const arButton = document.querySelector('.a-enter-vr-button[data-mode="ar"]');

                            if (!arButton) {
                                // If the button is not found, A-Frame determined AR is not possible.
                                showFallback("A-Frame 'Enter AR' button did not appear. AR is likely not supported or accessible.");
                            } else {
                                console.log("A-Frame 'Enter AR' button found. AR is likely supported.");
                                // No need to hide fallback here, showAR() already handles it.
                            }
                        }, 100); // Small delay
                    });

                    // Add a timeout to catch cases where webxr-ready never fires (if A-Frame itself fails to load or initialize properly)
                    const arInitTimeout = setTimeout(() => {
                        // If after a reasonable time, the AR container is still visible but the button hasn't appeared, show fallback.
                        
                        const arButton = document.querySelector('.a-enter-vr-button[data-mode="ar"]');
                        if (arContainer.style.display === 'block' && !arButton) {
                            showFallback("A-Frame AR initialization timed out or failed to show button.");
                        }
                    }, 5000); // 5 seconds timeout

                    // Clear the timeout if webxr-ready fires
                    scene.addEventListener('webxr-ready', () => clearTimeout(arInitTimeout));
                }
            } else {
                //WebXR API not found at all
                showFallback("WebXR API (navigator.xr) not found in this browser.");
            }
        });