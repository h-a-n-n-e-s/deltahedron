export type Mesh = {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export type MeshBuffers = {
  vertexBuffer: GPUBuffer;
  normalBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
}

export function getMeshBuffers(device:GPUDevice, mesh:Mesh):MeshBuffers {

  const vertexData = mesh.vertices;
  const normalData = mesh.normals;
  const indexData = mesh.indices;

  const vertexBuffer = device.createBuffer({
    label: 'vertex',
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

  const normalBuffer = device.createBuffer({
    label: 'normal',
    size: normalData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(normalBuffer, 0, normalData);

  const indexBuffer = device.createBuffer({
    label: 'index',
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, indexData);

  return {vertexBuffer:vertexBuffer, normalBuffer:normalBuffer, indexBuffer:indexBuffer};
}

// simple cube for line-list drawing
export const cubeLineVertices = new Float32Array([
  -1,-1,-1, -1,1,-1, 1,1,-1, 1,-1,-1,
  -1,-1, 1, -1,1, 1, 1,1, 1, 1,-1, 1,
]);
export const cubeLineIndices = new Uint32Array([0,1, 1,2, 2,3, 3,0, 0,4, 1,5, 2,6, 3,7, 4,5, 5,6, 6,7, 7,4]);
// export const cubeTriangleIndices = new Uint32Array([0,1,2, 0,2,3, 0,4,1, 1,4,5, 1,5,6, 1,6,2, 2,6,7, 2,7,3, 0,3,7, 0,7,4, 4,6,5, 4,7,6]);


// cube with 3 distinct normals per vertex
export const cubeVertices = new Float32Array([
  -1,-1,-1, -1,-1, 1, -1, 1, 1, -1, 1,-1,
   1,-1,-1,  1,-1, 1,  1, 1, 1,  1, 1,-1,
  -1,-1,-1, -1,-1, 1,  1,-1, 1,  1,-1,-1,
  -1, 1,-1, -1, 1, 1,  1, 1, 1,  1, 1,-1,
  -1,-1,-1, -1, 1,-1,  1, 1,-1,  1,-1,-1,
  -1,-1, 1, -1, 1, 1,  1, 1, 1,  1,-1, 1
]);
export const cubeNormals = new Float32Array([
  -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
   1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
   0,-1, 0,  0,-1, 0,  0,-1, 0,  0,-1, 0,
   0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
   0, 0,-1,  0, 0,-1,  0, 0,-1,  0, 0,-1,
   0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1
]);
export const cubeIndices = new Uint32Array([
  0,1,2, 0,2,3,
  4,7,5, 5,7,6,
  8,10,9, 8,11,10,
  12,13,15, 13,14,15,
  16,17,18, 16,18,19,
  20,23,21, 21,23,22
]);

// icosahedron with vertices on the unit sphere
const u = Math.sqrt(2 / (5 + Math.sqrt(5)));
const g = u * (1 + Math.sqrt(5))/2;
export const icosahedronVertices = new Float32Array([
   0, -u, -g,
  -u, -g,  0,
  -g,  0, -u,

   0,  u, -g,
   u, -g,  0,
  -g,  0,  u,

   0, -u,  g,
  -u,  g,  0,
   g,  0, -u,

   0,  u,  g,
   u,  g,  0,
   g,  0,  u,
]);
export const icosahedronIndices = new Uint32Array([
  0,1,2, 0,2,3, 0,3,8, 0,4,1, 0,8,4,
  1,4,6, 1,6,5, 1,5,2,
  2,7,3, 2,5,7,
  3,7,10, 3,10,8,
  4,11,6, 4,8,11,
  5,6,9, 5,9,7,
  6,11,9,
  7,9,10,
  8,10,11,
  9,11,10
]);
export const icosahedronLineIndices = new Uint32Array([
  0,1, 0,2, 0,3, 0,4, 0,8,
  1,2, 1,4, 1,5, 1,6,
  2,3, 2,5, 2,7,
  3,7, 3,8, 3,10,
  4,6, 4,8, 4,11,
  5,6, 5,7, 5,9,
  6,9, 6,11,
  7,9, 7,10,
  8,10, 8,11,
  9,10, 9,11,
  10,11
]);


export function icoSphereMesh(radius:number, refinementLevel:number):Mesh {
  const [norm, ind] = icoSphere(refinementLevel);

  const vert = norm.map(v => v * radius);

  return {vertices: vert, normals: norm, indices: ind}
}

// refined icosahedron to approximate a unit sphere
function icoSphere(refinementLevel:number) : [Float32Array, Uint32Array] {

  if (refinementLevel > 1) {

    const [vert, ind] = icoSphere(refinementLevel-1); // recursive call

    const triangleCount = ind.length/3;
    let vertexCount = vert.length/3;
    
    const vertNew = new Float32Array(3*(vertexCount+3/2*triangleCount)); // current vertices plus a new vertex on every edge
    const indNew = new Uint32Array(12*triangleCount); // 4 times as many as previous level

    vertNew.set(vert); // insert already existing vertices

    let pairs = new Map();
    
    // iterate over all triangles
    for (let t=0; t<triangleCount; t++) {

      const addedIndices = [];

      for (let k=0; k<3; k++) {

        // get triangle indices
        const i = ind[3*t+k];
        const j = ind[3*t+(k+1)%3];

        // every edge pair appears twice when iterating over triangles
        // so we keep track of edge pairs to not add a vertex twice

        // unique identifier for pair i,j using the Cantor pairing function
        const pairId = (i+j)*(i+j+1)/2+j;

        if (!pairs.has(pairId)) { // first time a pair is visited

          // add pairing(j,i) since only this reverse one will appear again
          pairs.set(pairId-j+i, vertexCount);

          // add index for new vertex
          addedIndices.push(vertexCount);

          const cc = 3*vertexCount; // coordinate count

          // create new vertex
          for (let o=0; o<3; o++) vertNew[cc+o] = vert[3*i+o] + vert[3*j+o];

          const norm = Math.sqrt(vertNew[cc]**2 + vertNew[cc+1]**2 + vertNew[cc+2]**2);

          for (let o=0; o<3; o++) vertNew[cc+o] /= norm;
          
          vertexCount++;

        }
        else { // second time a pair is visited

          addedIndices.push(pairs.get(pairId));
          pairs.delete(pairId); // pairs only appear twice

        }

      }
      
      // indices for 3 corner triangles
      for (let k=0; k<3; k++)
        indNew.set([ind[3*t+k], addedIndices[k], addedIndices[(k+2)%3]], 12*t+3*k);

      // indices for central triangle
      indNew.set(addedIndices, 12*t+9);

    }
    
    return [vertNew, indNew];
  }
  else return [icosahedronVertices, icosahedronIndices];

}


// cylinder
export function cylinderMesh(tesselation:number, r:number, h:number, caps=false):Mesh {

  let m = 1;
  if (caps) m = 2;

  const v = new Float32Array(6*tesselation*m+6*(m-1));
  const n = new Float32Array(6*tesselation*m);
  const f = new  Uint32Array(6*tesselation*m);

  // cap midpoints
  if (caps) {
    v.set([0, -h, 0], 6*tesselation);
    v.set([0,  h, 0], 6*tesselation+3);
  }

  for (let i=0; i<tesselation; i++) {
    const angle = 2*i*Math.PI/tesselation;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    v.set([r*c, -h, r*s], 6*i);
    v.set([r*c,  h, r*s], 6*i+3);
    n.set([c, 0, s], 6*i);
    n.set([c, 0, s], 6*i+3);
    // 0 1 3  0 3 2
    let a = 6*i;
    let b = 2*i;
    f[a]   = b;
    f[a+1] = b+1;
    f[a+2] = b+3;
    f[a+3] = b;
    f[a+4] = b+3;
    f[a+5] = b+2;
    if (i == tesselation-1) {
      f[a+2] = 1;
      f[a+4] = 1;
      f[a+5] = 0;
    }
    if (caps) {
      v.set([r*c, -h, r*s], 6*(tesselation+i));
      v.set([r*c,  h, r*s], 6*(tesselation+i)+3);
      n.set([0, -1, 0], 6*(tesselation+i));
      n.set([0,  1, 0], 6*(tesselation+i)+3);
      a += 6*tesselation;
      b += 2*tesselation;
      f[a]   = 2*tesselation;
      f[a+1] = b;
      f[a+2] = b+2;
      f[a+3] = 2*tesselation+1;
      f[a+4] = b+3;
      f[a+5] = b+1;
      if (i == tesselation-1) {
        f[a+2] = 0;
        f[a+4] = 1;
      }
    }
  }
  
  return {vertices: v, normals: n, indices: f}
}

// export const icosahedronEdges = new Uint32Array([
//   0,1, 0,2, 0,3, 0,4, 0,5,
//   1,2, 2,3, 3,4, 4,5, 5,1,
//   1,6, 2,6, 2,7, 3,7, 3,8, 4,8, 4,9, 5,9, 5,10, 1,10,
//   6,7, 7,8, 8,9, 9,10, 10,6,
//   // 6,11, 7,11, 8,11, 9,11, 10,11,
//   6,11, 7,11, 8,11, 10,11, 8,12, 9,12, //10,12, 11,12,
//   10,13, 11,13, 11,12, 9,13, //12,13
//   9,14, 11,14, 12,14, 13,14
// ]);

export const icosahedronEdges = new Uint32Array([
  0,1, 0,2, 0,3, 0,4, 0,5,
  1,2, 2,3, 3,4, 4,5, 5,1,
  1,6, 2,6, 2,7, 3,7, 3,8, 4,8, 4,9, 5,9, 5,10, 1,10,
  6,7, 7,8, 8,9, 9,10, 10,6,
  // 6,11, 7,11, 8,11, 9,11, 10,11,
  6,11, 7,11, 8,11, 8,12, 9,12, //10,12, 11,12,
  10,13, 9,13, //12,13
  9,14, 12,14, 13,14,
  10,15, 11,15, 12,15, 13,15, 14,15, 11,10, 11,12
]);

export const tetrahedronHalfEdges = new Uint32Array([
  1, 4, 2, 0,
  0, 6, 8, 1,
  3, 0, 4, 2,
  2,10, 7, 0,
  5, 2, 0, 1,
  4, 9,11, 2,
  7, 8, 1, 0,
  6, 3,10, 3,
  9, 1, 6, 3,
  8,11, 5, 1,
 11, 7, 3, 2,
 10, 5, 9, 3
]);

export const tetrahedronVertexPositions = new Float32Array([
   1, 1, 1,
  -1,-1, 1,
   1,-1,-1,
  -1, 1,-1
]);

export const torusHalfEdges = () => {

  const h = new Uint32Array(72*4*4);

  for (let i=0; i<4; i++) {
    const v = 12 * i;
    const e = 72 * i;
    
    // twin
    // for (let j=0; j<36; j++) {
    //   const o = e+2*j;
    //   h[4*o] = o+1;
    //   h[4*(o+1)] = o; 
    // }

    const previous = new Int32Array([
      -14, 24,-10, 11, -6, 13, -2, 17,  1, 18,
        9, 12,  3, 14,  5, 23, 15, 30, 10, 26,
       19, 28, 21, 16,  8, 33, 20, 37, 22, 41,
        7, 45, 47, 34, 25, 48, 35, 38, 27, 50,
       39, 42, 29, 52, 43, 46, 31, 54, 36, 59,
       40, 63, 44, 67, 32, 71, 55, 72, 57, 60,
       49, 74, 61, 64, 51, 76, 65, 68, 53, 78,
       69, 56
    ]);
    for (let j=0; j<72; j++) {
      let prev = previous[j];
      if (i === 0 && prev <  0) prev += 288;
      if (i === 3 && prev > 71) prev -= 288;
      h[4*(e+j)+1] = e + prev;
    }

    const next = new Int32Array([
      -15,  8,-11, 12, -7, 14, -3, 30, 24, 10,
       18,  3, 11,  5, 13, 16, 23,  7,  9, 20,
       26, 22, 28, 15,  1, 34, 19, 38, 21, 42,
       17, 46, 54, 25, 33, 36, 48, 27, 37, 40,
       50, 29, 41, 44, 52, 31, 45, 32, 35, 60,
       39, 64, 43, 68, 47, 56, 71, 58, 72, 49,
       59, 62, 74, 51, 63, 66, 76, 53, 67, 70,
       78, 55
    ]);
    for (let j=0; j<72; j++) {
      let ne = next[j];
      if (i === 0 && ne <  0) ne += 288;
      if (i === 3 && ne > 71) ne -= 288;
      h[4*(e+j)+2] = e + ne;
    }

    const vertex = new Uint32Array([
      0, 1, 1, 2, 2, 3, 3, 0, 5, 1,
      4, 1, 4, 2, 4, 3, 7, 3, 5, 4,
      6, 4, 7, 4, 0, 5, 5, 6, 6, 7,
      7, 0, 8, 0, 8, 5, 9, 5, 9, 6,
     10, 6,10, 7,11, 7,11, 0, 8, 9,
      9,10,10,11,11, 8,12, 8,13, 8,
     13, 9,14, 9,14,10,15,10,15,11,
     12,11
    ]);
    for (let j=0; j<72; j++) {
      let vert = vertex[j];
      if (i === 3 && vert > 11) vert -= 48;
      h[4*(e+j)+3] = v + vert;
    }
  }

  return h;
}

export const torusVertexPositions = new Float32Array([
  -0.5209,  0.5653, -0.6797,
  -1.1636,  0.6424, -1.1498,
  -0.7026,  0.5442, -1.7962,
  -0.0599,  0.4671, -1.3261,
  -0.5269,  1.1135, -1.2623,
  -0.9880,  1.2117, -0.6160,
  -0.3513,  1.6828, -0.7284,
   0.1157,  1.0365, -0.7922,
  -0.7783,  0.8035,  0.0392,
  -0.6584,  1.5937,  0.0048,
   0.1220,  1.4698, -0.1197,
   0.0021,  0.6796, -0.0853,
  -0.3049,  0.5904,  0.6479,
  -0.7720,  1.2368,  0.7117,
  -0.1353,  1.7079,  0.5992,
   0.3317,  1.0616,  0.5354,
  -0.1293,  1.1597,  1.1818,
  -0.7660,  0.6886,  1.2943,
  -0.1233,  0.6115,  1.7644,
   0.3377,  0.5134,  1.1181,
  -0.7694, -0.0089,  0.9027,
  -0.6410,  0.0059,  1.6922,
   0.1394, -0.1179,  1.5676,
   0.0110, -0.1328,  0.7781,
  -0.5066, -0.7384,  0.7059,
  -0.9677, -0.6403,  1.3523,
  -0.3250, -0.7173,  1.8224,
   0.1360, -0.8155,  1.1760,
  -0.5006, -1.2866,  1.2885,
  -1.1433, -1.2096,  0.8184,
  -0.6762, -1.8560,  0.7546,
  -0.0396, -1.3848,  0.6421,
  -1.0297, -0.8527,  0.1115,
  -1.1496, -1.6429,  0.1459,
  -0.3692, -1.7668,  0.0213,
  -0.2492, -0.9766, -0.0131,
  -0.7226, -0.7636, -0.6218,
  -1.3593, -1.2347, -0.5093,
  -0.8922, -1.8811, -0.5730,
  -0.2556, -1.4099, -0.6855,
  -0.8983, -1.3329, -1.1556,
  -1.3653, -0.6865, -1.0919,
  -0.9043, -0.7847, -1.7383,
  -0.2616, -0.8617, -1.2681,
  -1.0386, -0.0402, -0.7519,
  -1.1670, -0.0552, -1.5414,
  -0.3866, -0.1790, -1.6660,
  -0.2581, -0.1641, -0.8766
]); 