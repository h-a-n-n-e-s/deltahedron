import './style.css';
import { BallPark } from './ballPark';
import { Button, InfoSlider, PushButton, RadioButton, SwitchButton } from './ui';

Button.initialize(10, 10, 10);

const ballPark = new BallPark();

// const holdButton = new SwitchButton('hold', true);
// holdButton.onPush(() => ballPark.setHold(holdButton.on));

const loadButton = new PushButton('load', true);
loadButton.onPush( async () => ballPark.loadData());

const saveButton = new PushButton('save', true);
saveButton.onPush(async () => await ballPark.saveData());

const rotateButton = new SwitchButton('rotate', true);
rotateButton.onPush(() => ballPark.setRotation(rotateButton.on));

const faceButton = new SwitchButton('faces', true);
faceButton.onPush(() => ballPark.showFaces(faceButton.on));

const rodButton = new SwitchButton('rods', true);
rodButton.onPush(() => ballPark.showRods(rodButton.on));

const ballButton = new SwitchButton('balls', true);
ballButton.onPush(() => ballPark.showBalls(ballButton.on));

const showOnlyIsoRodsButton = new SwitchButton('iso rods', true);
showOnlyIsoRodsButton.onPush(() => ballPark.setShowOnlyIsoRods(showOnlyIsoRodsButton.on));

const subdivideButton = new PushButton('subdivide', true);
subdivideButton.onPush(() => {
  // if(confirm('Are you sure you want to subdivide?'))
    ballPark.startSubdivide(true);
});

const eraseAllButton = new PushButton('erase all', true);
eraseAllButton.onPush(() => {
  // if(confirm('Are you sure you want to erase this structure? If not you should save it first.'))
    ballPark.loadOctahedron();
});

const exportSTLButton = new PushButton('export STL', true);
exportSTLButton.onPush(async () => await ballPark.exportSTL());

// const bamButton = new PushButton('bam', true);
// bamButton.onPush( async () => ballPark.bam());

const gravitySlider = new InfoSlider(0, 9, 1, 1, 'inflation: ', 0, '', 140, document.body);
gravitySlider.onSlide(() => {
  const v = gravitySlider.value;
  ballPark.setGravity(v);
  if (v !== 0) gravitySlider.addClass('alert');
  else gravitySlider.removeClass('alert');
});
gravitySlider.setId('gravitySlider');

// slightly attractive force if 'a' key is pressed
document.addEventListener('keydown', (e) => {if (e.key === 'a') ballPark.setGravity(-0.2);});
document.addEventListener('keyup', (e) => {if (e.key === 'a') ballPark.setGravity(gravitySlider.value);});

const operationButtons = new RadioButton([
  {name:'add', func:(on) => ballPark.addVertex(on)},
  {name:'flip', func:(on) => ballPark.flipEdges(on)},
  {name:'collapse', func:(on) => ballPark.collapseEdges(on)},
], false);
operationButtons.click(0); // activate 'add' button

await ballPark.initialize();

// show stuff
faceButton.click();
rodButton.click();
ballButton.click();

gravitySlider.setSlider(gravitySlider.value);

// logo
const a = document.createElement('a');
a.href = 'https://formaldesign.net';
a.target = '_blank';
document.body.appendChild(a);
const img = document.createElement('img');
img.id = 'logo';
img.src = '/FD_anime2.svg';
a.appendChild(img);