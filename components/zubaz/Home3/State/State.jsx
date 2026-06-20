"use client";
import { useEffect, useState } from "react";
import CountUp from "react-countup";

const STATS = [
  { value: 3, suffix: "", label: "Free credits after sign-in" },
  { value: 1, suffix: "", label: "Credit for deeper research" },
  { value: 2, suffix: "", label: "Credits for the blueprint" },
  { value: 4, suffix: "", label: "Core outputs in each blueprint" },
];

const StateSection = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const section = document.getElementById("zubuz-counter");
      if (section) {
        const rect = section.getBoundingClientRect();
        setIsVisible(rect.top <= window.innerHeight && rect.bottom >= 0);
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="section dark-bg zubuz-section-padding5">
      <div id="zubuz-counter"></div>
      <div className="container">
        <div className="zubuz-counter-wrap2">
          {STATS.map((stat) => (
            <div key={stat.label} className="zubuz-counter-data light">
              <h2 className="zubuz-counter-number">
                <span className="zubuz-counter">
                  {isVisible ? <CountUp end={stat.value} duration={2} /> : stat.value}
                </span>
                {stat.suffix ? <em>{stat.suffix}</em> : null}
              </h2>
              <p>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StateSection;
