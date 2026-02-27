import React from 'react';

const MutationOverlay = ({ choices, onSelect }) => {
  if (!choices || choices.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      color: 'white',
      fontFamily: 'Inter, sans-serif'
    }}>
      <h1 style={{ 
        fontSize: '3rem', 
        marginBottom: '2rem', 
        textShadow: '0 0 20px #00ffff',
        letterSpacing: '5px'
      }}>
        EVOLVE
      </h1>
      <p style={{ marginBottom: '3rem', opacity: 0.8, fontSize: '1.2rem' }}>
        Select a passive mutation to enhance your snek:
      </p>
      
      <div style={{
        display: 'flex',
        gap: '20px',
        maxWidth: '1200px',
        width: '90%'
      }}>
        {choices.map((choice) => (
          <div 
            key={choice.id}
            onClick={() => onSelect(choice.id)}
            style={{
              flex: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '2px solid rgba(0, 255, 255, 0.3)',
              borderRadius: '20px',
              padding: '30px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              hoverBoxShadow: '0 0 30px rgba(0, 255, 255, 0.2)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = '#00ffff';
              e.currentTarget.style.transform = 'translateY(-10px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(0, 255, 255, 0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div>
              <h2 style={{ color: '#00ffff', marginBottom: '15px' }}>{choice.name}</h2>
              <p style={{ fontSize: '1.1rem', lineHeight: '1.4' }}>{choice.description}</p>
            </div>
            <button style={{
              marginTop: '30px',
              padding: '12px 25px',
              backgroundColor: '#00ffff',
              border: 'none',
              borderRadius: '50px',
              color: 'black',
              fontWeight: 'bold',
              cursor: 'pointer',
              textTransform: 'uppercase'
            }}>
              SELECT
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MutationOverlay;
