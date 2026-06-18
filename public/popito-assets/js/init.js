/*
 * Copyright (c) 2024 Frenify
 * Author: Frenify
 * This file is made for CURRENT TEMPLATE
*/


jQuery.fn.isInViewportPopito = function() {
	"use strict";
	var element 		= jQuery(this);
    var elementTop 		= element.offset().top;
    var elementBottom 	= elementTop + element.outerHeight();

    var viewportTop = jQuery(window).scrollTop();
    var viewportBottom = viewportTop + jQuery(window).height();

	var percentage		= (viewportBottom - elementTop)/element.outerHeight() * 100;
	return percentage;
};

(function($){
  "use strict";
  
	var PopitoBody = jQuery('body');
	var PopitoSearch = {
		search: '',
		text: '',
		ajax: false
	};

	var PopitoInit = {
		
		root: $(':root'),
		
		init: function(){
			this.BgImg();
			this.imgToSVG();
			this.moreMenu();
			this.reversedMenu();
			this.footerPosts();
			this.totopWinScroll();
			this.totopScroll();
			this.mobile__Menu();
			this.submenu__Mobile();
			this.stickyHeader();
			this.stickyTopBar();
			this.transformReading();
			this.nowReading();
			this.search();
			this.headerAdCloser();
			this.contact();
			this.pricing();
			this.accordion();
			this.projectCarousel();
			this.movingTags();
			this.featuredPostsWidget();
			this.progressBar();
			this.testimonials();
		},

		testimonials: function(){
			$('.fn__testimonials .owl-carousel').each(function(){
				var element = $(this),
					parent = element.closest('.fn__testimonials');
				element.owlCarousel({
					loop: true,
					margin:20,
					nav: false,
					dots: false,
					items: 1,
					smartSpeed: 1500
				});
				parent.find('.testimonial_nav .next').on('click',function(){
					element.trigger('next.owl.carousel');
					return false;
				});
				parent.find('.testimonial_nav .prev').on('click',function(){
					element.trigger('prev.owl.carousel', [1500]);
					return false;
				});
			});
			
		},

		progressBar: function(){
			$('.fn__progress_item').each(function(){
				var element = $(this);
				element.waypoint({
					handler: function(){
						if(!element.hasClass('active')){
							element.find('.bg_active').css({width: element.data('percent')+ '%'});
							element.addClass('active');
						}
					},
					offset:'80%'	
				});
			});
		},

		
		
		featuredPostsWidget: function(){
			$('.popito_fn_widget_featured .swiper-container').each(function(){
				var element				= $(this);
				// Main Slider
				var mainSliderOptions 	= {
					loop: true,
					speed: 1500,
					autoplay:{
						delay: 5000,
						disableOnInteraction: false,
					},
					slidesPerView: 1,
					spaceBetween: 10,
					direction: 'horizontal',
					loopAdditionalSlides: 10,
					navigation: {
						nextEl: element.find('.nav .next'),
						prevEl: element.find('.nav .prev'),
				  	},
					watchSlidesProgress: true,
				};
				new Swiper(element, mainSliderOptions);
			});
		},
		
		
		movingTags: function(){
			$(".fn__moving_tags .marquee").each(function(){
				var e = $(this);
				if(!e.hasClass('ready')){
					var direction = 'left';
					if(jQuery('body').hasClass('rtl')){
						direction = 'right';
					}
					e.addClass('ready').marquee({
						duplicated: true,
						duration: 18000,
						delayBeforeStart: 0,
						direction: direction,
						pauseOnHover: true,
						startVisible: true
					}).bind('finished', function () {
						PopitoInit.BgImg();
					});
					PopitoInit.BgImg();
				}
			});	
		},

		projectCarousel: function(){
			$('.fn_cs_post_carousel .owl-carousel').each(function(){
				var element				= $(this);
				element.owlCarousel({
					loop: true,
					margin: 50,
					nav: false,
					dots: false,
					autoWidth: false,
					items: 2,
					autoplay: true,
					autoplayHoverPause: true,
					autoplayTimeout: 7000,
					smartSpeed: 1500,
					slideTransition: 'linear',
					rtl: false,
					responsive : {
					// breakpoint from 0 up
					0 : {
						items : 1,
					},
					// breakpoint from 480 up
					1041 : {
						items : 2,
					},
				}
				});
				var nav = element.closest('.fn_cs_post_carousel').find('.slider__nav');
				nav.find('.next').off().click(function() {
					element.trigger('next.owl.carousel');
					return false;
				});
				// Go to the previous item
				nav.find('.prev').off().click(function() {
					// With optional speed parameter
					// Parameters has to be in square bracket '[]'
					element.trigger('prev.owl.carousel', [1500]);
					return false;
				});
			});
		},

		accordion: function(){
			$(document).on('click keydown', '.fn__accordion_item .accordion_header', function(e) {
				if (e.type === 'keydown' && e.key !== 'Enter') {
					return;
				}
				var element = $(this);
				var parent = element.closest('.fn__accordion_item');
				if(parent.hasClass('active')){
					parent.removeClass('active');
					parent.find('.accordion_content').slideUp();
				}else{
					parent.siblings().removeClass('active').find('.accordion_content').slideUp(); 
					parent.addClass('active');
					parent.find('.accordion_content').slideDown();
				}
				return false;
			});
		},

		pricing__fix: function(){
			$('.fn__pricing_tables').each(function(){
				var element = $(this);
				var active = element.find('.pt_filter a.active');
				var ccc		= element.find('.ccc');
				if(active.length){
					var w 		= active.outerWidth();
					ccc.css({width: w,left: active.position().left});
				}
				setTimeout(function(){
					ccc.addClass('ready');
				},10);
				element.addClass('ready');
			});
		},

		pricing: function(){
			PopitoInit.pricing__fix();
			$(document).on('click', '.fn__pricing_tables .pt_filter a', function(e) {
				var element		= $(this),
					parent		= element.closest('.fn__pricing_tables');
				if(!element.hasClass('active')){
					var ccc		= parent.find('.ccc');
					var w 		= element.outerWidth();
					ccc.css({width: w,left: element.position().left});
					if(element.hasClass('monthly')){
						parent.attr('data-active', 'monthly');
					}else{
						parent.attr('data-active', 'yearly');
					}
					element.addClass('active');
					element.siblings().removeClass('active');
				}
				return false;
			});
		},

		contact: function(){
			$(document).on('click', '.fn__contact .fn__main_button', function(e) {
				var element		= $(this),
					parent		= element.closest('.fn__contact');
				var name 		= parent.find('.name').val();
				var email 		= parent.find('.email').val();
				var topic 		= parent.find('.topic').val();
				var message 	= parent.find('.message').val();
				var returnmessage = parent.find('.returnmessage');
				var success     = returnmessage.data('success');
				var empty_notice = parent.find('.empty_notice');

				returnmessage.empty(); //To empty previous error/success message.
				//checking for blank fields	
				if(name === '' || email === '' || message === ''){
					empty_notice.addClass('active');
					setTimeout(function() {
						empty_notice.removeClass('active');
					}, 2000);
				}
				else{
					// Returns successful data submission message when the entered information is stored in database.
					$.post("assets/modal/contact.php",{ ajax_name: name, ajax_email: email, ajax_message:message, ajax_topic: topic}, function(data) {

						returnmessage.append(data);//Append returned message to message paragraph


						if(returnmessage.find(".contact_error").length){
							returnmessage.addClass('active');
							setTimeout(function() {
								returnmessage.removeClass('active');
							}, 2000);
						}else{
							returnmessage.append("<span class='contact_success'>"+ success +"</span>");
							returnmessage.addClass('active');
							setTimeout(function() {
								returnmessage.removeClass('active');
							}, 4000);
						}

						if(data===""){
							parent.find('form')[0].reset();//To reset form fields on success
						}

					});
				}
				return false; 
			});
		},

		headerAdCloser: function(){
			$(document).on('click', '.popito_fn_header .header_ad .ad_closer', function(e) {
				$(this).closest('.header_ad').slideUp();
				return false;
			});
		},

		search: function(){
			var input = $('.popito_fn_searchbox .searchbox input[type="text"]');
			$(document).on('click', '.search a', function(e) {
				e.preventDefault();
				$('body').addClass('search-opened');
				
				setTimeout(function(){
					$('.popito_fn_searchbox .searchbox input[type="text"]')[0].focus();
				},310);
				return false;
			});
			$(document).on('click', '.popito_fn_searchbox', function(e) {
				e.preventDefault();
				e.stopPropagation();
				$('body').removeClass('search-opened');
			});
			
			$(document).on('click', '.search_content', function(e) {
				e.stopPropagation();
			});

			// filter search
			var timeout = null;
			input.on('keyup', function(){
				var field 	= $(this);
				var text 	= field.val();
				
				clearTimeout(timeout);
				
				timeout = setTimeout(function () {
					PopitoSearch.search = text;
					if(text === PopitoSearch.text){
						return false;
					}
					if(text == ''){
						$('.popito_fn_searchbox .search_result').removeClass('has_content');
						$('.popito_fn_searchbox .search_result ul').html('');
					}
					if(!PopitoSearch.ajax && text != ''){
						PopitoSearch.text	= text;
						PopitoInit.filterAjaxSearch(text);
					}
					
				}, 700);
			});
		},

		filterAjaxSearch: function(text){
			$('.popito_fn_searchbox .search_result').addClass('has_content');
			PopitoSearch.ajax = true;
			var filesToSearch = [
				'404.html',	
				'about.html',	
				'account.html',	
				'author.html',	
				'authors.html',	
				'contact.html',	
				'index.html',
				'membership.html',
				'projects.html',	
				'sign-in.html',	
				'sign-up.html',	
				'single.html',	
				'tag.html',	
				'tags.html',	
			]; // List of HTML files to search
			var searchResultsHTML = '';
			var i = 0;
			var count = filesToSearch.length;
			filesToSearch.forEach(function(file) {
				$.get(file, function(data) {
					i++;
					var $mainContent = $(data).find('main.popito_fn_content');
					var fileContent = $mainContent.not('script').text().toLowerCase(); // Convert file content to lowercase
					var searchText = text.toLowerCase(); // Convert search query to lowercase
					var occurrences = PopitoInit.countOccurrences(fileContent, searchText); // Count occurrences of search text
        			if (occurrences > 0) {
						searchResultsHTML += '<li>Found '+occurrences+' time(s) in <a href="'+file+'">'+file+'</a></li>';
					}
					
					PopitoInit.filterAjaxResult(searchResultsHTML,i,count);
				}).fail(function() {
					console.error('Error searching file:', file);
				});
			});
		},

		filterAjaxResult: function(html,i,count){
			if(i === count){
				if(html === ''){
					html = '<li>&#128533; Sorry, no content matched your criteria.</li>';
				}
				$('.popito_fn_searchbox .search_result ul').html(html);
				PopitoSearch.ajax = false;
			}
		},

		countOccurrences: function(str, subStr) {
			var count = 0;
			var lastIndex = 0;
			while ((lastIndex = str.indexOf(subStr, lastIndex)) !== -1) {
				count++;
				lastIndex += subStr.length;
			}
			return count;
		},

		stickyTopBar: function(){
			var stickyHeader = $('.popito_fn_stickynav');
			if(stickyHeader.length){
				stickyHeader.on('mouseenter',function(){
					stickyHeader.addClass('hover');
				}).on('mouseleave',function(){
					stickyHeader.removeClass('hover');
				});
			}
		},
		
		stickyHeader: function(){
			var sticky		= $('.popito_fn_stickynav');
			var lastScrollTop = 0;
			if(sticky.length){
				$(window).scroll(function() {
					var scrollTop = $(this).scrollTop();
					if (scrollTop < lastScrollTop && scrollTop > 400) {
						PopitoBody.addClass('sticky-active');
					}else{
						PopitoBody.removeClass('sticky-active');
					}
					// Update last scroll position
					lastScrollTop = scrollTop;
				});
			}
		},
		
		transformReading: function(){
			var stickyHeader = $('.popito_fn_stickynav.ajax_enable');
			if(stickyHeader.length && PopitoBody.hasClass('single-post')){
				var lastScrollTop = 0;
				$(window).scroll(function(){
					var st = $(this).scrollTop();
					if (st > lastScrollTop){
						// downscroll
						stickyHeader.addClass('active');
					}
					lastScrollTop = st;
				});
			}
				
		},
		
		nowReading: function(){
			var title 		= $('.header_post_reading .reading_post .title');
			var progress 	= $('.header_post_reading .progress');
			$(window).on('resize scroll', function() {
				var bs 		= $('.popito_fn_blog_single');
				bs.each(function(){
					var e 	= $(this);
					var f 	= e.isInViewportByFrenify();
					var p	= f[1];
					if(f[0]){
						var newPostTitle = e.data('post-title');
						if(title.html() !== newPostTitle){
							title.html(e.data('post-title'));
						}
						var currentURL	= window.location.href;
						var newURL		= e.data('post-url');
						if(currentURL !== newURL){
							window.history.pushState("", newPostTitle, newURL);
						}
					}
					if(p >= 0 && p <= 100){
						progress.css({width: p + '%'});
					}
				});
			});	
		},

		submenu__Mobile: function(){
			var nav 						= $('.popito_fn_mobnav .mob_bot');
			nav.each(function(){
				$(this).find('a').off().on('click', function(e){
					var element 			= $(this);
					var parentItem			= element.parent('li');
					var parentItems			= element.parents('li');
					var parentUls			= parentItem.parents('ul.sub-menu');
					var subMenu				= element.next('ul');
					var allSubMenusParents 	= nav.find('li');

					allSubMenusParents.removeClass('opened');

					if(subMenu.length){
						e.preventDefault();

						if(!(subMenu.parent('li').hasClass('active'))){
							if(!(parentItems.hasClass('opened'))){parentItems.addClass('opened');}

							allSubMenusParents.each(function(){
								var el = $(this);
								if(!el.hasClass('opened')){el.find('ul.sub-menu').slideUp();}
							});

							allSubMenusParents.removeClass('active');
							parentUls.parent('li').addClass('active');
							subMenu.parent('li').addClass('active');
							subMenu.slideDown();


						}else{
							subMenu.parent('li').removeClass('active');
							subMenu.slideUp();
						}
						return false;
					}
				});
			});
		},
		
		
		mobile__Menu: function(){
			var mobNav		= $('.popito_fn_mobnav');
			var trigger		= mobNav.find('.right__trigger a');
			var mobBottom	= mobNav.find('.mob_bot');
			trigger.off().on('click',function(){
				if(mobNav.hasClass('menu_opened')){
					mobNav.removeClass('menu_opened');
					mobBottom.slideUp();
				}else{
					mobNav.addClass('menu_opened');
					mobBottom.slideDown();
				}
				return false;
			});
		},
		
		totopScroll: function(){
			var minSpeed 		= 500;
			var maxSpeed		= 1500;
			$(".popito_fn_totop,.popito_fn_fixedtotop").off().on('click', function(e) {
				e.preventDefault();
				var speed		= ($(window).scrollTop()-$(window).height())/2;
				if(speed < minSpeed){speed = minSpeed;}
				if(speed > maxSpeed){speed = maxSpeed;}
				$("html, body").animate({ scrollTop: 0 }, speed);
				return false;
			});
		},
		
		totopWinScroll: function (){
			var WinOffset	= $(window).scrollTop();
			var totop		= $('a.popito_fn_fixedtotop');
			
			var footerTotop = $('.popito_fn_totop');
			var f 	= footerTotop.isInViewportPopito();
			if(f > -1200){
				totop.addClass('footer_totop_active');
			}else{
				totop.removeClass('footer_totop_active');
			}
			if(totop.length){
				if(WinOffset > 300){
					totop.addClass('active');
				}else{
					totop.removeClass('active');
				}
			}
		},

		
		footerPosts: function(){
			$('.popito_fn_vertical_slider').each(function(){
				var e = $(this);
				if(e.hasClass('ready')){
					return false;
				}
				e.addClass('ready');
				var vs = e.find('.vertical_slider');
				var vsHTML = vs.html();
				vs.html(vsHTML.repeat(3));
				PopitoInit.vs_changeslide(1,e);
				PopitoInit.vs_start(vs,e);
			});
		},

		vs_start: function(vs,element){
			var timeout 		= 6000;
			var time 			= null;
			clearInterval(time);
			time = setInterval(function(){
				var index 		= vs.find('.current').index() + 2;
				PopitoInit.vs_changeslide(index,element);
			}, timeout);
		},
		
		vs_changeslide: function(index,element){
			var vs 				= element.find('.vertical_slider'),
				children 		= vs.children('.item'),
				length			= children.length;
				index			= (index + length) % length;
			var el 				= children.eq(index-1);

			if(!el.hasClass('current')){
				children.removeClass('current next1 next2 prev1 prev2 next3 prev3');
				el.addClass('current');
				var next1_index = (index + 1) % length;
				var next2_index = (index + 2) % length;
				var next3_index = (index + 3) % length;
				var prev1_index = (index - 1 + length) % length;
				var prev2_index = (index - 2 + length) % length;
				var prev3_index = (index - 3 + length) % length;
				children.eq(next1_index-1).addClass('next1');
				children.eq(next2_index-1).addClass('next2');
				children.eq(prev1_index-1).addClass('prev1');
				children.eq(prev2_index-1).addClass('prev2');
				if(length > 6){
					children.eq(next3_index-1).addClass('next3');
					children.eq(prev3_index-1).addClass('prev3');
				}
			}
		},

		reversedMenu: function(){
			$('.popito_fn_main_nav ul').each(function(){
				var e = $(this),
					w = e.offset().left + 240,
					W = $('body').width();
				if(w>W){
					e.addClass('reverse');
				}
			});
		},

		menuCenter: function(){
			// var nav 		= $('.popito_fn_nav');
			// nav.each(function(){
			// 	var element 		= $(this);
			// 	var leftWidth 		= 0;
			// 	var rightWidth 		= 0;
			// 	var header,left,right;
			// 	if(element.hasClass('main_nav')){
			// 		header			= $('.popito_fn_header');
			// 		left 			= header.find('.logo');
			// 		right 			= header.find('.right__trigger');
			// 		if(left.length){
			// 			leftWidth 	= parseInt(left.outerWidth(true));
			// 		}
			// 		if(right.length){
			// 			rightWidth	= parseInt(right.outerWidth(true));
			// 		}
			// 		element.css({width: (header.width() - rightWidth - leftWidth) + 'px',opacity: 1});
			// 	}else if(element.hasClass('sticky_nav')){
			// 		header			= $('.popito_fn_stickynav');
			// 		right 			= header.find('.right__trigger');
			// 		if(right.length){
			// 			rightWidth	= parseInt(right.outerWidth(true));
			// 		}
			// 		element.css({width: (header.width() - rightWidth) + 'px',opacity: 1});
			// 	}
			// });
			// $("body").removeClass("frenify-overflow");
		},


		moreMenu: function(){
			PopitoInit.menuCenter();
			$('.popito_fn_nav').each(function(){
				var nav = $(this);
				var menu = nav.find('.menu');
				var more = menu.find('.more');
				var moreBtn = more.find('a');
				var moreBtnWidth = moreBtn.width();
				var w = 0, a = 0,html = '';
				nav.find('.popito_fn_main_nav > li').each(function(){
					var e = $(this);
					a+= parseInt(e.outerWidth(true));
					a+= moreBtnWidth;
					if(w+a>menu.width()){
						e.addClass('disabled');
						html+='<li class="'+e.attr('class')+'">'+e.html()+'</li>';
					}else{
						e.removeClass('disabled');
					}
					a-= moreBtnWidth;
					w+= a;a=0;
				});
				if(html !== ''){
					more.addClass('active');
					more.find('.sub-menu').html(html);
				}else{
					more.removeClass('active');
				}
			});
				
			
		},
		
		
		imgToSVG: function(){
			$('img.fn__svg').each(function(){
				var img 		= $(this);
				var imgClass	= img.attr('class');
				var imgURL		= img.attr('src');

				$.get(imgURL, function(data) {
					var svg 	= $(data).find('svg');
					if(typeof imgClass !== 'undefined') {
						svg 	= svg.attr('class', imgClass+' replaced-svg');
					}
					img.replaceWith(svg);

				}, 'xml');

			});	
		},

	  	BgImg: function(){
			var div = $('*[data-bg-img]');
			div.each(function(){
				var element = $(this);
				var attrBg	= element.attr('data-bg-img');
				if(typeof(attrBg) !== 'undefined'){
					element.css({backgroundImage:'url('+attrBg+')'});
				}
			});
		},
  	};
  	
	
	// READY Functions
	$(document).ready(function(){
		
		PopitoInit.init();
		
	});
	
	// RESIZE Functions
	$(window).on('resize',function(){
		PopitoInit.moreMenu();
	});
	
	
	
	// LOAD Functions
	$(window).on('load',function(){
		setTimeout(function(){
			PopitoInit.pricing__fix();
		},200);
	});
	
	// SCROLL Functions
	$(window).on('scroll',function(){
		PopitoInit.totopWinScroll();
	});

	window.addEventListener("load", function(){
		PopitoInit.moreMenu();
	});
  
})(jQuery);