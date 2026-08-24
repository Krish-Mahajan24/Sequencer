/* =========================================================
   SEQUENCER ABOUT PAGE
   ========================================================= */


/* =========================================================
   WAIT FOR PAGE
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {


        /* =====================================================
           HERO VIDEO
           ===================================================== */

        const video =
            document.getElementById(
                "heroVideo"
            );


        if (video) {

            /*
             * Force the video to remain muted.
             *
             * This is important because browsers
             * normally block autoplay videos that
             * contain sound.
             */

            video.muted = true;

            video.setAttribute(
                "muted",
                ""
            );

            video.setAttribute(
                "playsinline",
                ""
            );


            /*
             * Try to start the video.
             */

            function startVideo() {

                const playPromise =
                    video.play();


                /*
                 * Some browsers return a Promise
                 * from video.play().
                 */

                if (
                    playPromise !== undefined
                ) {

                    playPromise.catch(
                        function () {

                            /*
                             * Autoplay may be blocked
                             * until the user interacts
                             * with the page.
                             *
                             * We do not show an error
                             * because the video poster/
                             * background remains available.
                             */

                        }
                    );

                }

            }


            /*
             * Start immediately.
             */

            startVideo();


            /*
             * Some browsers are more reliable
             * when playback is attempted after
             * the first user interaction.
             */

            const interactionEvents = [
                "click",
                "touchstart",
                "scroll",
                "keydown"
            ];


            function interactionStart() {

                startVideo();

                /*
                 * Once the user interacts,
                 * we don't need these listeners anymore.
                 */

                interactionEvents.forEach(
                    function (eventName) {

                        document.removeEventListener(
                            eventName,
                            interactionStart
                        );

                    }
                );

            }


            interactionEvents.forEach(
                function (eventName) {

                    document.addEventListener(
                        eventName,
                        interactionStart,
                        {
                            once: true,
                            passive: true
                        }
                    );

                }
            );


            /*
             * If the user switches tabs,
             * pause the video.
             *
             * When they return, start it again.
             */

            document.addEventListener(
                "visibilitychange",
                function () {

                    if (
                        document.hidden
                    ) {

                        video.pause();

                    } else {

                        startVideo();

                    }

                }
            );

        }



        /* =====================================================
           MOBILE MENU
           ===================================================== */

        const menuButton =
            document.getElementById(
                "menuButton"
            );


        const navLinks =
            document.querySelector(
                ".nav-links"
            );


        if (
            menuButton &&
            navLinks
        ) {

            menuButton.addEventListener(
                "click",
                function () {

                    navLinks.classList.toggle(
                        "open"
                    );

                }
            );


            /*
             * Close mobile menu after
             * clicking a navigation link.
             */

            const links =
                navLinks.querySelectorAll(
                    "a"
                );


            links.forEach(
                function (link) {

                    link.addEventListener(
                        "click",
                        function () {

                            navLinks.classList.remove(
                                "open"
                            );

                        }
                    );

                }
            );

        }



        /* =====================================================
           SCROLL REVEAL
           ===================================================== */

        const revealElements =
            document.querySelectorAll(
                ".reveal"
            );


        /*
         * If the browser supports
         * IntersectionObserver,
         * use it for smooth reveal animations.
         */

        if (
            "IntersectionObserver"
            in window
        ) {

            const observer =
                new IntersectionObserver(
                    function (
                        entries,
                        observerInstance
                    ) {

                        entries.forEach(
                            function (entry) {

                                if (
                                    entry.isIntersecting
                                ) {

                                    entry.target.classList.add(
                                        "visible"
                                    );


                                    /*
                                     * Stop observing this
                                     * element after it appears.
                                     */

                                    observerInstance.unobserve(
                                        entry.target
                                    );

                                }

                            }
                        );

                    },
                    {
                        threshold: 0.12
                    }
                );


            revealElements.forEach(
                function (element) {

                    observer.observe(
                        element
                    );

                }
            );


        } else {

            /*
             * Older browsers:
             * simply show everything.
             */

            revealElements.forEach(
                function (element) {

                    element.classList.add(
                        "visible"
                    );

                }
            );

        }



        /* =====================================================
           FOOTER YEAR
           ===================================================== */

        const year =
            document.getElementById(
                "year"
            );


        if (year) {

            year.textContent =
                new Date()
                    .getFullYear();

        }


    }
);
