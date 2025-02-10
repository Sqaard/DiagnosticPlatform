import React, { useState } from 'react';

const MotorControl = ({ onToggleMotor, motorOn }) => {
  return (
    <div>
      <button onClick={onToggleMotor}>
        {motorOn ? 'Выключить' : 'Включить'}
      </button>
    </div>
  );
};

export default MotorControl;
