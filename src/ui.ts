export class Button {

  button:HTMLButtonElement;

  private static height = 22; // px height of Button elements
  private static separation = 10; // separation width between buttons
  
  // measures for dynamic placement
  private static left = 0;
  private static top = 0;
  private static right = 0;

  private static idList: Array<string> = [];
  private static widthList: Array<number> = [];

  constructor(name:string, isOnTop:boolean) {

    this.button = document.createElement('button');
    this.button.innerHTML = name;

    // make width multiple of 10px
    const width = (name.length+1)*10; // for 16px mono font
    this.button.style.width = String(width)+'px';

    if (isOnTop) {
      this.button.className = 'topButton';
      this.button.id = name.replace(/\s+/g,'')+'But'+String(Button.idList.length);
      Button.idList.push(this.button.id);
      Button.widthList.push(width);

      // dynamic placement
      if (Button.left + width > window.innerWidth - Button.right) {
        Button.left = Button.separation; // set back
        Button.top += Button.height + Button.separation; // new row
      }
      this.button.style.left = String(Button.left)+'px';
      this.button.style.top = String(Button.top)+'px';
      Button.left += width + Button.separation;

      document.body.appendChild(this.button);
    }
    
    this.button.classList.add('switchButtonOff');

  }

  static initialize(left:number, top:number, right:number) {

    Button.left = left;
    Button.top = top;
    Button.right = right;

    const buttonReorder = () => {
      let l = left;
      let t = top;
      for (let i=0; i<Button.idList.length; i++) {
        const w = Button.widthList[i];
        if ( l + w > window.innerWidth - right ) {
          l = Button.separation;
          t += Button.height + Button.separation;
        }
        const but = document.getElementById(Button.idList[i]);
        but!.style.left = String(l)+'px';
        but!.style.top = String(t)+'px';
        l += w + Button.separation;
      }
    };
    
    window.addEventListener('resize', buttonReorder);

    // return buttonReorder;
  }

  click = () => this.button.dispatchEvent(new Event('click'));

  hide = () => this.button.style.visibility = 'hidden';
  show = () => this.button.style.visibility = 'visible';
}

export class SwitchButton extends Button {

  on = false; // button state

  private func = () => {}; // optional function

  constructor(name:string, isOnTop=false) {

    super(name, isOnTop);

    this.button.addEventListener('click', () => {
      this.switch();
    }, false);
  }

  switch = () => {
    // invert colors
    if (!this.on) this.button.classList.replace('switchButtonOff', 'switchButtonOn');
    else this.button.classList.replace('switchButtonOn', 'switchButtonOff');

    // switch 'on' state
    this.on = !this.on;

    // optional callback function
    this.func();
  }

  onPush = (func:()=>void) => this.func = func;
  
}


export class PushButton extends Button {

  constructor(name:string, isOnTop=false) {

    super(name, isOnTop);

    this.button.classList.add('pushButton');
  }

  onPush = (func:()=>void) => this.button.addEventListener('click', () => {func()}, false);
}

export class RadioButton {

  private activeButton: SwitchButton | undefined;
  private buttons: Array<SwitchButton> = [];

  constructor(buttonList:Array<{name:string, func:(on:boolean)=>void}>, isOnTop=true) {

    for(const entry of buttonList) {
      const butt = new SwitchButton(entry.name, isOnTop);
      if (!isOnTop) {
        butt.button.id = entry.name+'RadioBut';
        document.body.appendChild(butt.button);
      }
      
      butt.onPush(() => {
        if (butt.on === true) {
          if (this.activeButton !== undefined) this.activeButton.switch();
          this.activeButton = butt;
        }
        else // butt was active before
          this.activeButton = undefined;
        entry.func(butt.on);
      });

      this.buttons.push(butt);
    }
  }

  click = (index:number) => this.buttons[index].click();
}

///////////////////////////////////////////////////////////////////////////////

export class InfoSlider {
  
  value:number;

  private element:HTMLDivElement; // div container for text and slider
  text:HTMLParagraphElement;
  private slider:HTMLInputElement;
  private prefix;
  private digits;
  private suffix;

  constructor(min:number, max:number, step:number, init:number, prefix:string, digits:number, suffix:string, width:number, parent:HTMLElement) {

    this.digits = digits;
    this.suffix = suffix;

    this.element = document.createElement('div');
    this.element.className = 'sliderContainer';
    this.element.style.width = String(width)+'px';

    if (prefix.includes('.svg')) { // use .svg file instead of string
      this.prefix = '';
      const svgImg = document.createElement('img');
      svgImg.src = prefix;
      svgImg.className = 'prefixSvg'
      this.element.appendChild(svgImg);
    }
    else this.prefix = prefix;

    this.text = document.createElement('p');
    this.text.innerHTML = this.prefix+init.toFixed(digits)+suffix;
    this.element.appendChild(this.text);

    this.slider = document.createElement('input');
    this.slider.type = 'range';
    this.slider.className = 'slider';
    this.slider.min = String(min);
    this.slider.max = String(max);
    this.slider.step = String(step);
    this.slider.value = String(init);
    this.element.appendChild(this.slider);

    this.value = init;

    parent.appendChild(this.element);
  }

  onSlide = (func:()=>void) => {
    this.slider.addEventListener('input', () => {
      this.value = this.slider.valueAsNumber;
      this.text.innerHTML = this.prefix+this.value.toFixed(this.digits)+this.suffix;
      func();
    });
  }

  setId = (id:string) => this.element.id = id;

  setSlider = (val:number) => {
    this.slider.valueAsNumber = val;
    this.slider.dispatchEvent(new Event('input'));
  }

  hide = () => this.element.style.visibility = 'hidden';
  show = () => this.element.style.visibility = 'visible';

  addClass = (c:string) => this.element.classList.add(c);
  removeClass = (c:string) => this.element.classList.remove(c);
}


///////////////////////////////////////////////////////////////////////////////

export class Selection {
  
  private selectElem:HTMLSelectElement;

  constructor(options:IterableIterator<MIDIInput>, cangeCallback?:(e:Event)=>void, defaultOptionLabel?: string) {

    this.selectElem = document.createElement('select');
    this.selectElem.id = 'midiInput';

    const addOption = (value: string, text:string) => {
      const optionElem = document.createElement('option');
      optionElem.value = value;
      optionElem.text = text;
      this.selectElem.add(optionElem);
    }

    addOption('', defaultOptionLabel || 'select an option');

    if (cangeCallback) this.selectElem.onchange = cangeCallback;

    for(let option of options) {
      if (option.name) addOption(option.id, option.name);
      
      // for debug
      if (option.name == 'microKEY2 KEYBOARD') { // 'minilogue xd KBD/KNOB'
        this.selectElem.value = option.id;
        this.selectElem.dispatchEvent(new Event('change'));
      }
      ////////////
      
    }
    document.body.appendChild(this.selectElem);
  }
}

export class Info {

  div: HTMLDivElement;
  span: HTMLSpanElement;
  toolTip!: HTMLDivElement;

  set!: () => string;

  constructor(id:string) {

    this.div = document.createElement('div');
    this.div.id = id;
    document.body.appendChild(this.div);

    this.span = document.createElement('span');
    this.div.appendChild(this.span);

  }

  update = () => {
    if (this.set !== undefined) this.span.innerHTML =  this.set();
  }

  createTooltip = (top:string, right:string, width:string, text:string) => {
    this.toolTip = this.div.appendChild(document.createElement('div'));
    this.toolTip.className = 'tooltip';
    this.toolTip.style.top = top;
    this.toolTip.style.right = right;
    this.toolTip.style.width = width;
    this.toolTip.innerHTML = text;
  }
}

export class ActivityIndicator {
  
  private div: HTMLDivElement;

  constructor() {
    this.div = document.createElement('div');
    this.div.id = 'activityIndicator';
    document.body.appendChild(this.div);
  }

  run = () => this.div.innerHTML = '.';
  stop = () => this.div.innerHTML = '';

}