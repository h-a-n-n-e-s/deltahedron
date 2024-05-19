import './style.css';
import { BallPark } from "./ballPark";
import { Button, InfoSlider, PushButton, RadioButton, SwitchButton } from './button-slider';

Button.initialize(10, 10, 10);

const ballPark = new BallPark();

const holdButton = new SwitchButton('hold', true);
holdButton.onPush(() => ballPark.setHold(holdButton.on));

const rotateButton = new SwitchButton('rotate', true);
rotateButton.onPush(() => ballPark.setRotation(rotateButton.on));

new RadioButton([
  {name:'add', func:(on) => ballPark.addVertex(on)},
  {name:'flip', func:(on) => ballPark.flipEdges(on)},
  {name:'remove', func:(on) => ballPark.removeEdges(on)},
]);

const saveButton = new PushButton('save', true);
saveButton.onPush(() => ballPark.saveData());

const loadButton = new PushButton('load', true);
loadButton.onPush( async () => ballPark.loadData()); 

const gravitySlider = new InfoSlider(0, 10, 1, 1, 'repulsion: ', 0, '', 200, document.body);
gravitySlider.onSlide(() => ballPark.setGravity(gravitySlider.value));
gravitySlider.setId('gravitySlider');

await ballPark.initialize();
ballPark.setGravity(gravitySlider.value);