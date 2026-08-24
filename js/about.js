   document.addEventListener(
            "DOMContentLoaded",
            function () {

                const video =
                    document.getElementById("heroVideo");

                /*
                 * Force the Wix video to start.
                 * Because it is muted + playsinline,
                 * browsers normally allow autoplay.
                 */
if (video) {

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const startVideo = () => {

        const playPromise = video.play();

        if (playPromise !== undefined) {

            playPromise.catch(() => {

                /*
                 * If Safari temporarily blocks playback,
                 * retry when the video becomes ready.
                 */

            });

        }

    };


    /*
     * Start immediately instead of waiting
     * for the rest of the page.
     */

    startVideo();


    /*
     * Retry as soon as enough video data is available.
     */

    video.addEventListener(
        "loadeddata",
        startVideo,
        { once: true }
    );


    video.addEventListener(
        "canplay",
        startVideo,
        { once: true }
    );


    /*
     * Resume when returning to the page.
     */

    document.addEventListener(
        "visibilitychange",
        function () {

            if (
                document.visibilityState === "visible"
            ) {

                startVideo();

            }

        }
    );

}

                /*
                 * Simple mobile menu behavior.
                 */

                const menuButton =
                    document.getElementById(
                        "menuButton"
                    );

                const nav =
                    document.querySelector(
                        ".nav-links"
                    );


                if (
                    menuButton &&
                    nav
                ) {

                    menuButton.addEventListener(
                        "click",
                        function () {

                            const isOpen =
                                nav.classList.contains(
                                    "mobile-open"
                                );


                            if (!isOpen) {

                                nav.classList.add(
                                    "mobile-open"
                                );

                                nav.style.display =
                                    "flex";

                                nav.style.position =
                                    "absolute";

                                nav.style.top =
                                    "72px";

                                nav.style.left =
                                    "16px";

                                nav.style.right =
                                    "16px";

                                nav.style.padding =
                                    "12px";

                                nav.style.flexDirection =
                                    "column";

                                nav.style.alignItems =
                                    "stretch";

                                nav.style.background =
                                    "rgba(10,5,10,.98)";

                                nav.style.border =
                                    "1px solid rgba(255,59,141,.2)";

                                nav.style.borderRadius =
                                    "12px";

                            } else {

                                nav.classList.remove(
                                    "mobile-open"
                                );

                                nav.style.display =
                                    "";

                            }

                        }
                    );

                }

            }
        );
