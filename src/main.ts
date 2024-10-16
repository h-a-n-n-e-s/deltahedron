import './style.css';
import { BallPark } from "./ballPark";
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

const hideFacesButton = new SwitchButton('hide faces', true);
hideFacesButton.onPush(() => ballPark.hideFaces(hideFacesButton.on));

const hideScaffoldButton = new SwitchButton('hide scaffold', true);
hideScaffoldButton.onPush(() => ballPark.hideBallsAndRods(hideScaffoldButton.on));

const showOnlyIsoRodsButton = new SwitchButton('iso edges', true);
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

const gravitySlider = new InfoSlider(0, 10, 1, 1, 'inflation: ', 0, '', 200, document.body);
gravitySlider.onSlide(() => ballPark.setGravity(gravitySlider.value));
gravitySlider.setId('gravitySlider');

const operationButtons = new RadioButton([
  {name:'add', func:(on) => ballPark.addVertex(on)},
  {name:'flip', func:(on) => ballPark.flipEdges(on)},
  {name:'collapse', func:(on) => ballPark.collapseEdges(on)},
], false);
operationButtons.click(0); // activate 'add' button

await ballPark.initialize();
ballPark.setGravity(gravitySlider.value);