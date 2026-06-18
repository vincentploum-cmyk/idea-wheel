(function($) {
    "use strict";
  
    const $documentOn = $(document);
    const $windowOn = $(window);
  
    $documentOn.ready( function() {
  
      /* ================================
       Mobile Menu Js Start
    ================================ */
    
    $('#mobile-menu').meanmenu({
        meanMenuContainer: '.mobile-menu',
        meanScreenWidth: "1199",
        meanExpand: ['<i class="far fa-plus"></i>'],
    });
    
     /* ================================
       Sidebar Toggle Js Start
    ================================ */

      $(".offcanvas__close,.offcanvas__overlay").on("click", function () {
        $(".offcanvas__info").removeClass("info-open");
        $(".offcanvas__overlay").removeClass("overlay-open");
      });
      $(".sidebar__toggle").on("click", function () {
        $(".offcanvas__info").addClass("info-open");
        $(".offcanvas__overlay").addClass("overlay-open");
      });
      
       /* ================================
       Body Overlay Js Start
    ================================ */

      $(".body-overlay").on("click", function () {
        $(".offcanvas__area").removeClass("offcanvas-opened");
        $(".df-search-area").removeClass("opened");
        $(".body-overlay").removeClass("opened");
      });
  
      /* ================================
       Sticky Header Js Start
    ================================ */

      $windowOn.on("scroll", function () {
        if ($(this).scrollTop() > 250) {
          $("#header-sticky").addClass("sticky");
        } else {
          $("#header-sticky").removeClass("sticky");
        }
      });  
      
      
      
       /* ================================
       Video & Image Popup Js Start
    ================================ */

      $(".img-popup").magnificPopup({
        type: "image",
        gallery: {
          enabled: true,
        },
      });

      $(".video-popup").magnificPopup({
        type: "iframe",
        callbacks: {},
      });
  
      /* ================================
       Counterup Js Start
    ================================ */

      $(".gt-count").counterUp({
        delay: 15,
        time: 4000,
      });
  
         /* ================================
       Wow Animation Js Start
    ================================ */

      new WOW().init();
  
      /* ================================
       Nice Select Js Start
    ================================ */

    if ($('.single-select').length) {
        $('.single-select').niceSelect();
    }

    /* ================================
      Hover Active Js Start
    ================================ */

    
   $(".accordion-item").click(function () {
        $(".accordion-item").removeClass("active");
        $(this).addClass("active");
    });
    
    
   /* ================================
       Parallaxie Js Start
    ================================ */

    if ($('.parallaxie').length && $(window).width() > 991) {
        if ($(window).width() > 768) {
            $('.parallaxie').parallaxie({
                speed: 0.55,
                offset: 0,
            });
        }
    }

    

     /* ================================
       GT Brand Slider Js Start
    ================================ */

    if($('.gt-brand-slider').length > 0) {
        const gtBrandSlider = new Swiper(".gt-brand-slider", {
            spaceBetween: 30,
            speed: 1300,
            loop: true,
            //centeredSlides: true,
            autoplay: {
                delay: 2000,
                disableOnInteraction: false,
            },
            navigation: {
                nextEl: ".array-prev",
                prevEl: ".array-next",
            },
            breakpoints: {
                1399: {
                    slidesPerView: 6,
                },
                1199: {
                    slidesPerView: 5,
                },
                991: {
                    slidesPerView: 4,
                },
                767: {
                    slidesPerView: 3,
                },
                575: {
                    slidesPerView: 2,
                },
                400: {
                    slidesPerView: 2,
                },
                0: {
                    slidesPerView: 1,
                },
            },
        });
    }

    if($('.gt-brand-slider-4').length > 0) {
        const gtBrandSlider4 = new Swiper(".gt-brand-slider-4", {
            spaceBetween: 30,
            speed: 1300,
            loop: true,
            //centeredSlides: true,
            autoplay: {
                delay: 2000,
                disableOnInteraction: false,
            },
            navigation: {
                nextEl: ".array-prev",
                prevEl: ".array-next",
            },
            breakpoints: {
                1399: {
                    slidesPerView: 5,
                },
                1199: {
                    slidesPerView: 4,
                },
                991: {
                    slidesPerView: 3,
                },
                767: {
                    slidesPerView: 2.5,
                },
                575: {
                    slidesPerView: 1.8,
                },
                400: {
                    slidesPerView: 1.5,
                },
                0: {
                    slidesPerView: 1,
                },
            },
        });
    }

    if($('.brand-slider').length > 0) {
        const brandSlider = new Swiper(".brand-slider", {
            spaceBetween: 30,
            speed: 2000,
            loop: true,
            autoplay: {
                delay: 1000,
                disableOnInteraction: false,
            },

            breakpoints: {
                1199: {
                    slidesPerView: 4,
                },
                991: {
                    slidesPerView: 3,
                },
                767: {
                    slidesPerView: 2,
                },
                575: {
                    slidesPerView: 2,
                },
                0: {
                    slidesPerView: 1,
                },
            },
        });
    }

    if($('.gt-screenshot-slider').length > 0) {
        const gtScreenshotSlider = new Swiper(".gt-screenshot-slider", {
            spaceBetween: 30,
            speed: 1300,
            loop: true,
            centeredSlides: true,
            autoplay: {
                delay: 2000,
                disableOnInteraction: false,
            },
             pagination: {
                el: ".dot",
                clickable: true,
            },
            breakpoints: {
                1399: {
                    slidesPerView: 5.6,
                },
                1199: {
                    slidesPerView: 5,
                },
                991: {
                    slidesPerView: 4,
                },
                767: {
                    slidesPerView: 3,
                },
                575: {
                    slidesPerView: 2,
                },
                400: {
                    slidesPerView: 2,
                },
                0: {
                    slidesPerView: 1,
                },
            },
        });
    }

    if($('.gt-product-tour-slider').length > 0) {
        const gtProductTourSlider = new Swiper(".gt-product-tour-slider", {
            spaceBetween: 30,
            speed: 1300,
            loop: true,
            centeredSlides: true,
            //  pagination: {
            //     el: ".dot",
            //     clickable: true,
            // },
             pagination: {
                el: ".gt-product-dot",
                clickable: true,
                renderBullet: function(index, className) {
                    const dotContent = document.querySelectorAll(
                        ".gt-product-dot .dot-content"
                    );
                    return `
                <span class="${className}">
                    ${dotContent[index]?.outerHTML || ""}
                </span>
            `;
                },
            },
            breakpoints: {
                1199: {
                    slidesPerView: 3,
                },
                991: {
                    slidesPerView: 2,
                },
                767: {
                    slidesPerView: 1,
                },
                575: {
                    slidesPerView: 1,
                },
                400: {
                    slidesPerView: 1,
                },
                0: {
                    slidesPerView: 1,
                },
            },
        });
    }

    if($('.gt-software-app-slider').length > 0) {
        const gtSoftwareAppSlider = new Swiper(".gt-software-app-slider", {
            spaceBetween: 30,
            speed: 1300,
            loop: true,
            effect: "fade",
            mousewheel: true,
             autoplay: {
                delay: 2000,
                disableOnInteraction: false,
            },
             pagination: {
                el: ".dot01",
                clickable: true,
            },
        });
    }

    $(".gt-icon-box li").hover(
		// Function to run when the mouse enters the element
		function () {
			// Remove the "active" class from all elements
			$(".gt-icon-box li").removeClass("active");
			// Add the "active" class to the currently hovered element
			$(this).addClass("active");
		}
	);
    
    

    /* ================================
       GT Testimonial Slider Js Start
    ================================ */

    if($('.gt-testimonial-slider').length > 0) {
        const gtTestimonialSlider = new Swiper(".gt-testimonial-slider", {
            spaceBetween: 30,
            speed: 1300,
            loop: true,
            autoplay: {
                delay: 2000,
                disableOnInteraction: false,
            },
             pagination: {
                el: ".dot",
                clickable: true,
            },
            breakpoints: {
                1399: {
                    slidesPerView: 4,
                },
                1199: {
                    slidesPerView: 3,
                },
                991: {
                    slidesPerView: 2,
                },
                767: {
                    slidesPerView: 2,
                },
                575: {
                    slidesPerView: 1,
                },
                400: {
                    slidesPerView: 1,
                },
                0: {
                    slidesPerView: 1,
                },
            },
        });
    }


    if($('.testimonial-slider-5').length > 0) {
            const testimonialSlider5 = new Swiper(".testimonial-slider-5", {
                spaceBetween: 30,
                speed: 2000,
                loop: true,
                autoplay: {
                    delay: 1000,
                    disableOnInteraction: false,
                },
                navigation: {
                    nextEl: ".array-prev",
                    prevEl: ".array-next",
                },
                breakpoints: {
                    1199: {
                        slidesPerView: 2,
                    },
                    991: {
                        slidesPerView: 1,
                    },
                    767: {
                        slidesPerView: 1,
                    },
                    575: {
                        slidesPerView: 1,
                    },
                    0: {
                        slidesPerView: 1,
                    },
                },
            });
    }

     /* ================================
       GT News Slider Js Start
    ================================ */

    if($('.gt-news-slider').length > 0) {
        const gtNewsSlider = new Swiper(".gt-news-slider", {
            spaceBetween: 30,
            speed: 1300,
            loop: true,
            centeredSlides: true,
            autoplay: {
                delay: 2000,
                disableOnInteraction: false,
            },
            navigation: {
                nextEl: ".array-prev",
                prevEl: ".array-next",
            },
            breakpoints: {
                1699: {
                    slidesPerView: 4.1,
                },
                1499: {
                    slidesPerView: 4.2,
                },
                1199: {
                    slidesPerView: 3,
                },
                991: {
                    slidesPerView: 2,
                },
                767: {
                    slidesPerView: 2,
                },
                575: {
                    slidesPerView: 2,
                },
                400: {
                    slidesPerView: 1.3,
                },
                0: {
                    slidesPerView: 1,
                },
            },
        });
    }

    /* ================================
       Gt Hero Image Rotate Style Start
    ================================ */

    if ($('.gt-hero-image').length) {
        $(window).on("scroll", function() {
            var scrollPos = $(this).scrollTop();

            if (scrollPos > 50) {
                $('.gt-hero-left').css('transform', 'rotate(-15deg)');
                $('.gt-hero-right').css('transform', 'rotate(15deg)');
            } else {
                $('.gt-hero-left').css('transform', 'rotate(0deg)');
                $('.gt-hero-right').css('transform', 'rotate(0deg)');
            }
        });
    }

    if ($('.gt-dashboard-image-items').length) {

        $(window).on('scroll', function() {
            const scrollPos = $(window).scrollTop();
            const sectionOffset = $('.gt-dashboard-image-items').offset().top;
            const windowHeight = $(window).height();

            if (scrollPos + windowHeight > sectionOffset + 100) {
                $('.gt-mobile-app-image-2').css('transform', 'rotate(15deg)');
            } else {
                $('.gt-mobile-app-image-2').css('transform', 'rotate(0deg)');
            }
        });

    }

      // circle-progress
        $(".circle-bar").loading();
    
     //>> Project Hover Js Start <<//
    const getSlide = $('.main-box, .box').length - 1;
    const slideCal = 100 / getSlide + '%';
    
    $('.box').css({
        "width": slideCal
    });
    
    $(document).on('mouseenter', '.box', function() {
        $('.box').removeClass('active');
        $(this).addClass('active');
    }); 


      /* ================================
       Mouse Cursor Animation Js Start
    ================================ */

    if ($(".mouseCursor").length > 0) {
        function itCursor() {
            var myCursor = jQuery(".mouseCursor");
            if (myCursor.length) {
                if ($("body")) {
                    const e = document.querySelector(".cursor-inner"),
                        t = document.querySelector(".cursor-outer");
                    let n,
                        i = 0,
                        o = !1;
                    (window.onmousemove = function(s) {
                        o ||
                            (t.style.transform =
                                "translate(" + s.clientX + "px, " + s.clientY + "px)"),
                            (e.style.transform =
                                "translate(" + s.clientX + "px, " + s.clientY + "px)"),
                            (n = s.clientY),
                            (i = s.clientX);
                    }),
                    $("body").on(
                            "mouseenter",
                            "button, a, .cursor-pointer",
                            function() {
                                e.classList.add("cursor-hover"),
                                    t.classList.add("cursor-hover");
                            }
                        ),
                        $("body").on(
                            "mouseleave",
                            "button, a, .cursor-pointer",
                            function() {
                                ($(this).is("a", "button") &&
                                    $(this).closest(".cursor-pointer").length) ||
                                (e.classList.remove("cursor-hover"),
                                    t.classList.remove("cursor-hover"));
                            }
                        ),
                        (e.style.visibility = "visible"),
                        (t.style.visibility = "visible");
                }
            }
        }
        itCursor();
      }
  

   /* ================================
       Back To Top Button Js Start
    ================================ */

   $windowOn.on('scroll', function() {
        var windowScrollTop = $(this).scrollTop();
        var windowHeight = $(window).height();
        var documentHeight = $(document).height();

        // Check if scrolled to bottom
        if (windowScrollTop + windowHeight >= documentHeight - 10) { 
            $("#gt-back-top").addClass("show");
        } else {
            $("#gt-back-top").removeClass("show");
        }
    });

    $documentOn.on('click', '#gt-back-top', function() {
        $('html, body').animate({ scrollTop: 0 }, 800);
        return false;
    });

   
    
    }); // End Document Ready Function

     $.fn.loading = function() {
        const DEFAULTS = {
            backgroundColor: '#b3cef6',
            progressColor: '#4b86db',
            percent: 75,
            duration: 2000
        };

        $(this).each(function() {
            const $target = $(this);

            const opts = {
                backgroundColor: $target.data('color') ? $target.data('color').split(',')[0] : DEFAULTS.backgroundColor,
                progressColor: $target.data('color') ? $target.data('color').split(',')[1] : DEFAULTS.progressColor,
                percent: $target.data('percent') ? $target.data('percent') : DEFAULTS.percent,
                duration: $target.data('duration') ? $target.data('duration') : DEFAULTS.duration
            };
            // console.log(opts);

            $target.append('<div class="background"></div><div class="rotate"></div><div class="left"></div><div class="right"></div><div class=""><span>' + opts.percent + '%</span></div>');

            $target.find('.background').css('background-color', opts.backgroundColor);
            $target.find('.left').css('background-color', opts.backgroundColor);
            $target.find('.rotate').css('background-color', opts.progressColor);
            $target.find('.right').css('background-color', opts.progressColor);

            const $rotate = $target.find('.rotate');
            setTimeout(function() {
                $rotate.css({
                    'transition': 'transform ' + opts.duration + 'ms linear',
                    'transform': 'rotate(' + opts.percent * 3.6 + 'deg)'
                });
            }, 1);

            if (opts.percent > 50) {
                let animationRight = 'toggle ' + (opts.duration / opts.percent * 50) + 'ms step-end';
                let animationLeft = 'toggle ' + (opts.duration / opts.percent * 50) + 'ms step-start';
                $target.find('.right').css({
                    animation: animationRight,
                    opacity: 1
                });
                $target.find('.left').css({
                    animation: animationLeft,
                    opacity: 0
                });
            }
        });
    }
    

   // Preloader
        function handlePreloader() {
        if (typeof jQuery !== "undefined" && $('.preloader').length) {
            $('.preloader').delay(200).fadeOut(500);
        } else {
            // Vanilla JS fallback (optional, for non-jQuery builds)
            const preloader = document.querySelector('.preloader');
            if (preloader) {
                setTimeout(() => {
                    preloader.style.transition = 'opacity 0.5s ease';
                    preloader.style.opacity = '0';
                    setTimeout(() => {
                        preloader.style.display = 'none';
                    }, 500);
                }, 200);
            }
        }
    }

    // jQuery version
    if (typeof jQuery !== "undefined") {
        $(window).on('load', function() {
            handlePreloader();
        });
    } else {
        // Vanilla JS version
        window.addEventListener('load', handlePreloader);
    }



  
  })(jQuery); // End jQuery