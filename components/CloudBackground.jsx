export default function CloudBackground() {
  return (
    <>
      <style>{`@keyframes ocBlobDrift{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.12)}}`}</style>
      <div className="oc-blob" style={blobOne} aria-hidden="true" />
      <div className="oc-blob" style={blobTwo} aria-hidden="true" />
    </>
  );
}

const baseBlob = {
  position: 'fixed',
  borderRadius: '50%',
  filter: 'blur(70px)',
  pointerEvents: 'none',
  zIndex: 0,
  animation: 'ocBlobDrift 22s ease-in-out infinite',
};

const blobOne = {
  ...baseBlob,
  width: 480,
  height: 480,
  top: '-8%',
  left: '-6%',
  background: '#7C3AED',
  opacity: 0.28,
};

const blobTwo = {
  ...baseBlob,
  width: 420,
  height: 420,
  right: '-6%',
  bottom: '-12%',
  background: '#FF4D8D',
  opacity: 0.22,
  animationDelay: '-7s',
};
