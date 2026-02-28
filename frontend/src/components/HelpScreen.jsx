import React from 'react';

const HelpScreen = ({ onBack }) => {
  return (
    <div className="menu-screen help-screen">
      <div className="glass-card">
        <h2>HOW TO PLAY</h2>
        
        <div className="help-section">
          <h3>CONTROLS</h3>
          <div className="control-grid">
            <div className="control-item">
              <span className="key">MOUSE</span>
              <span className="desc">Direct Movement</span>
            </div>
            <div className="control-item">
              <span className="key">L-CLICK</span>
              <span className="desc">Boost (Consumes Mass)</span>
            </div>
            <div className="control-item">
              <span className="key">SPACE</span>
              <span className="desc">Activate Mutation Ability</span>
            </div>
            <div className="control-item">
              <span className="key">TOUCH</span>
              <span className="desc">Virtual Joystick (Left Side)</span>
            </div>
          </div>
        </div>
        
        <div className="help-section">
          <h3>MECHANICS</h3>
          <ul>
            <li>Eat <strong>Glowing Pellets</strong> to grow longer.</li>
            <li>Reaching <strong>Mutation Milestones</strong> grants special powers.</li>
            <li>Don't crawl into walls or other snakes!</li>
          </ul>
        </div>
        
        <button className="menu-btn secondary back-btn" onClick={onBack}>BACK</button>
      </div>
    </div>
  );
};

export default HelpScreen;
