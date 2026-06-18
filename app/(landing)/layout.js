export default function LandingLayout({ children }) {
  return (
    <>
      <link rel="stylesheet" href="/boostly/assets/css/bootstrap.min.css" />
      <link rel="stylesheet" href="/boostly/assets/css/all.min.css" />
      <link rel="stylesheet" href="/boostly/assets/css/animate.css" />
      <link rel="stylesheet" href="/boostly/assets/css/magnific-popup.css" />
      <link rel="stylesheet" href="/boostly/assets/css/meanmenu.css" />
      <link rel="stylesheet" href="/boostly/assets/css/swiper-bundle.min.css" />
      <link rel="stylesheet" href="/boostly/assets/css/nice-select.css" />
      <link rel="stylesheet" href="/boostly/assets/css/flaticon.css" />
      <link rel="stylesheet" href="/boostly/assets/css/main.css" />
      {children}
    </>
  );
}
