import { vec3 } from './algebra';

export function saveBinary(data:ArrayBuffer|Uint32Array, filename:string) {
  let blob = new Blob([data], {type: 'octet/stream'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const openFile = async () => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.addEventListener('change', () => {
      input.files instanceof FileList
        ? resolve(input.files[0])
        : console.error('No file!');
    });
    input.click();
  });
};

export const readFile = async (call:(data:ArrayBuffer)=>void) => {
  const file = await openFile() as File;
  const reader = new FileReader();
  reader.onload = evt => {
    const data = evt.target?.result as ArrayBuffer;
    call(data);
  }
  reader.readAsArrayBuffer(file);
}

export function exportSTL(triangleVertices:Float32Array) {

  const triangleCount = triangleVertices.length / 9;
  
  let offset = 80; // skip header
  const buffy = new ArrayBuffer(80 + 4 + triangleCount * 50);
  const output = new DataView(buffy);

  output.setUint32(offset, triangleCount, true); offset += 4;

  for (let i=0; i<triangleCount; i++) {
    
    const a = triangleVertices.slice(9*i  ,9*i+3);
    const b = triangleVertices.slice(9*i+3,9*i+6);
    const c = triangleVertices.slice(9*i+6,9*i+9);
    
    writeFace(a, b, c);
  }

  saveBinary(buffy, 'deltahedron.stl');

  function writeFace(a:Float32Array, b:Float32Array, c:Float32Array) {

    const normal = vec3.cross(vec3.subtract(b,a), vec3.subtract(c,a));
    vec3.normalize(normal);

    writeVector(normal);
    writeVector(a);
    writeVector(b);
    writeVector(c);
    output.setUint16(offset, 0, true); offset += 2;
  }

  function writeVector(v:Float32Array) {
    output.setFloat32(offset, v[0], true); offset += 4;
		output.setFloat32(offset, v[1], true); offset += 4;
		output.setFloat32(offset, v[2], true); offset += 4;
  }
}