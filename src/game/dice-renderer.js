export class DiceRenderer {
  constructor(containerElement) {
    this.container = containerElement;
  }

  async rollAndDisplay(diceCount, side) {
    this.clear();
    const results = [];
    const diceElements = [];

    for (let i = 0; i < diceCount; i++) {
      const roll = Math.floor(Math.random() * 6) + 1;
      results.push(roll);
      
      const die = this._createDieElement(roll, i);
      if (side === 'attacker') {
         die.classList.add('attacker-die');
      } else {
         die.classList.add('defender-die');
      }
      
      this.container.appendChild(die);
      diceElements.push({ element: die, result: roll });
    }

    // Animate and reveal
    return new Promise((resolve) => {
      let revealed = 0;
      diceElements.forEach((dieObj, index) => {
        setTimeout(() => {
          dieObj.element.classList.remove('dice-tumble');
          dieObj.element.textContent = dieObj.result;
          
          if (dieObj.result === 6) dieObj.element.classList.add('kill');
          else if (dieObj.result >= 4) dieObj.element.classList.add('pain');
          else dieObj.element.classList.add('miss');
          
          revealed++;
          if (revealed === diceCount) resolve(results);
        }, index * 500); // 500ms stagger
      });
      if (diceCount === 0) resolve([]);
    });
  }

  clear() {
    this.container.innerHTML = '';
  }

  _createDieElement(value, index) {
    const die = document.createElement('div');
    die.className = 'die dice-tumble';
    die.textContent = '?';
    // The CSS would handle the 'dice-tumble' animation.
    die.style.animationDelay = `${index * 0.1}s`;
    
    // Style for the die
    die.style.display = 'inline-block';
    die.style.width = '40px';
    die.style.height = '40px';
    die.style.lineHeight = '40px';
    die.style.textAlign = 'center';
    die.style.margin = '5px';
    die.style.border = '1px solid #ccc';
    die.style.borderRadius = '5px';
    die.style.backgroundColor = '#f9f9f9';
    die.style.fontWeight = 'bold';
    
    return die;
  }
}
