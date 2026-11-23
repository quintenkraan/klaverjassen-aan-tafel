import { useMemo } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { TABLE_RADIUS, TABLE_TOP } from './layout';

/**
 * Een bruin café, naar de foto die je gaf: donkergroene lambrisering met spiegels,
 * okergele muren met wandlampjes, hoge ramen met groene gordijnen, houten tafeltjes
 * met rode kaarsglazen, een biervat en een donkere vloer met een geblokte strook.
 * (Op de muur hangen gewone schilderijtjes in plaats van portretten.)
 */

const W = 6.4; // breedte (x)
const D = 5.6; // diepte (z)
const H = 3.2; // hoogte
const WOOD = '#3a2617';
const WOOD_DARK = '#24170e';
const PANEL = '#2c3326';
const OCHRE = '#b36a2c';
const CURTAIN = '#26382c';

function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): Texture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function useFloor() {
  return useMemo(() => {
    const t = canvasTexture(512, 512, (ctx) => {
      ctx.fillStyle = '#26221f';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 2500; i++) {
        ctx.fillStyle = `rgba(${150 + Math.random() * 60},${140 + Math.random() * 50},${120 + Math.random() * 40},${Math.random() * 0.12})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 512; i += 128) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
    });
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(6, 6);
    return t;
  }, []);
}

function useChecker() {
  return useMemo(() => {
    const t = canvasTexture(256, 32, (ctx) => {
      for (let x = 0; x < 16; x++)
        for (let y = 0; y < 2; y++) {
          ctx.fillStyle = (x + y) % 2 ? '#d8d2c4' : '#151515';
          ctx.fillRect(x * 16, y * 16, 16, 16);
        }
    });
    t.wrapS = RepeatWrapping;
    t.repeat.set(10, 1);
    return t;
  }, []);
}

/** Een eenvoudig landschapje in een lijst (geen echte personen). */
function usePainting(hue: number) {
  return useMemo(
    () =>
      canvasTexture(256, 320, (ctx) => {
        const g = ctx.createLinearGradient(0, 0, 0, 320);
        g.addColorStop(0, `hsl(${hue}, 25%, 62%)`);
        g.addColorStop(0.55, `hsl(${hue + 20}, 20%, 40%)`);
        g.addColorStop(1, `hsl(${hue + 40}, 25%, 22%)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 320);
        ctx.fillStyle = 'rgba(30,25,20,0.55)';
        ctx.beginPath();
        ctx.moveTo(0, 230);
        ctx.quadraticCurveTo(90, 170, 160, 215);
        ctx.quadraticCurveTo(210, 245, 256, 200);
        ctx.lineTo(256, 320);
        ctx.lineTo(0, 320);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,240,210,0.6)';
        ctx.beginPath();
        ctx.arc(190, 80, 22, 0, Math.PI * 2);
        ctx.fill();
      }),
    [hue],
  );
}

function Sconce({
  position,
  rotationY = 0,
}: {
  position: [number, number, number];
  rotationY?: number;
}) {
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.03, 0.12, 0.1]} />
        <meshStandardMaterial color="#1c1c1c" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.02, 0.12]}>
        <sphereGeometry args={[0.045, 12, 10]} />
        <meshStandardMaterial color="#fff3d6" emissive="#ffcf8a" emissiveIntensity={3} />
      </mesh>
      <pointLight
        position={[0, 0.02, 0.2]}
        intensity={1.6}
        distance={4}
        decay={2}
        color="#ffbf73"
      />
    </group>
  );
}

function Candle({
  position,
  light = true,
}: {
  position: [number, number, number];
  light?: boolean;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.035, 0.028, 0.09, 16]} />
        <meshStandardMaterial
          color="#c4141c"
          emissive="#ff2a1a"
          emissiveIntensity={1.4}
          transparent
          opacity={0.85}
          roughness={0.2}
        />
      </mesh>
      {light && (
        <pointLight
          position={[0, 0.12, 0]}
          intensity={0.35}
          distance={1.6}
          decay={2}
          color="#ff4a2a"
        />
      )}
    </group>
  );
}

function Chair({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0.46, 0]} castShadow>
        <boxGeometry args={[0.44, 0.05, 0.42]} />
        <meshStandardMaterial color={WOOD} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.5, 0.01]}>
        <boxGeometry args={[0.4, 0.04, 0.38]} />
        <meshStandardMaterial color="#7a1418" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.85, -0.2]} castShadow>
        <boxGeometry args={[0.42, 0.62, 0.04]} />
        <meshStandardMaterial color={WOOD} roughness={0.6} />
      </mesh>
      {[
        [-0.19, -0.18],
        [0.19, -0.18],
        [-0.19, 0.18],
        [0.19, 0.18],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x!, 0.22, z!]}>
          <boxGeometry args={[0.035, 0.44, 0.035]} />
          <meshStandardMaterial color={WOOD_DARK} />
        </mesh>
      ))}
    </group>
  );
}

function SideTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.74, 0]} castShadow>
        <boxGeometry args={[0.7, 0.04, 0.7]} />
        <meshStandardMaterial color={WOOD} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <boxGeometry args={[0.08, 0.72, 0.08]} />
        <meshStandardMaterial color={WOOD_DARK} />
      </mesh>
      <Candle position={[0.1, 0.76, 0.05]} />
      <Chair position={[0, 0, 0.55]} rotationY={Math.PI} />
      <Chair position={[0, 0, -0.55]} rotationY={0} />
    </group>
  );
}

function Barrel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.36, 0.36, 1, 24]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.8} />
      </mesh>
      {[0.15, 0.85].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.375, 0.375, 0.05, 24]} />
          <meshStandardMaterial color="#6b6b6b" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      <Candle position={[0.05, 1, 0]} />
    </group>
  );
}

/** De speeltafel: rond, houten, met een groen kaartkleedje. */
export function GameTable() {
  return (
    <group>
      <mesh position={[0, TABLE_TOP - 0.025, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS, 0.04, 48]} />
        <meshStandardMaterial color={WOOD} roughness={0.45} />
      </mesh>
      <mesh position={[0, TABLE_TOP - 0.003, 0]} receiveShadow>
        <cylinderGeometry args={[TABLE_RADIUS - 0.1, TABLE_RADIUS - 0.1, 0.006, 48]} />
        <meshStandardMaterial color="#1d5a37" roughness={1} />
      </mesh>
      <mesh position={[0, TABLE_TOP / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.08, TABLE_TOP - 0.05, 16]} />
        <meshStandardMaterial color={WOOD_DARK} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.32, 0.36, 0.04, 24]} />
        <meshStandardMaterial color={WOOD_DARK} />
      </mesh>
      <Candle position={[0.3, TABLE_TOP, -0.3]} />
    </group>
  );
}

export function Cafe() {
  const floor = useFloor();
  const checker = useChecker();
  const art1 = usePainting(30);
  const art2 = usePainting(200);

  return (
    <group>
      <color attach="background" args={['#0d0907']} />
      <fog attach="fog" args={['#120c08', 4.5, 10]} />
      <hemisphereLight args={['#ffcf9a', '#2a1c12', 0.35]} />
      {/* Zacht licht boven de speeltafel, zodat de kaarten leesbaar blijven */}
      <spotLight
        position={[0, 2.7, 0.3]}
        angle={0.7}
        penumbra={0.9}
        intensity={14}
        decay={1.6}
        color="#ffd7a0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />

      {/* Vloer met geblokte strook */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={floor} roughness={0.85} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-1.2, 0.002, 0.4]} rotation-z={0.35}>
        <planeGeometry args={[4, 0.08]} />
        <meshStandardMaterial map={checker} roughness={0.8} />
      </mesh>
      {/* Plafond */}
      <mesh rotation-x={Math.PI / 2} position={[0, H, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#1a120c" />
      </mesh>

      {/* Achterwand: lambrisering, spiegels, oker erboven */}
      <group position={[0, 0, -D / 2]}>
        <mesh position={[0, 0.7, 0.03]}>
          <boxGeometry args={[W, 1.4, 0.06]} />
          <meshStandardMaterial color={PANEL} roughness={0.7} />
        </mesh>
        {[-1.4, -0.45, 0.5, 1.45].map((x) => (
          <mesh key={x} position={[x, 0.65, 0.07]}>
            <boxGeometry args={[0.8, 0.9, 0.02]} />
            <meshStandardMaterial color="#232a1f" roughness={0.6} />
          </mesh>
        ))}
        {/* Bankje langs de wand */}
        <mesh position={[0, 0.45, 0.3]}>
          <boxGeometry args={[W - 1.2, 0.08, 0.5]} />
          <meshStandardMaterial color="#2f3a2e" roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.95, 0.02]}>
          <boxGeometry args={[W, 1.1, 0.04]} />
          <meshStandardMaterial color={PANEL} roughness={0.7} />
        </mesh>
        {[-0.95, 0.95].map((x) => (
          <group key={x} position={[x, 1.75, 0.06]}>
            <mesh>
              <boxGeometry args={[1.45, 0.62, 0.05]} />
              <meshStandardMaterial color={WOOD} />
            </mesh>
            <mesh position={[0, 0, 0.03]}>
              <planeGeometry args={[1.33, 0.5]} />
              <meshStandardMaterial color="#2b2a28" metalness={0.9} roughness={0.08} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 2.85, 0.01]}>
          <boxGeometry args={[W, 0.7, 0.02]} />
          <meshStandardMaterial color={OCHRE} roughness={0.9} />
        </mesh>
        {[
          [-0.45, art1],
          [0.45, art2],
        ].map(([x, art]) => (
          <group key={x as number} position={[x as number, 2.72, 0.05]}>
            <mesh>
              <boxGeometry args={[0.5, 0.6, 0.03]} />
              <meshStandardMaterial color="#e8e2d4" />
            </mesh>
            <mesh position={[0, 0, 0.02]}>
              <planeGeometry args={[0.38, 0.48]} />
              <meshStandardMaterial map={art as Texture} roughness={0.9} />
            </mesh>
          </group>
        ))}
        {/* Klok */}
        <mesh position={[-1.6, 2.7, 0.05]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.16, 0.16, 0.03, 32]} />
          <meshStandardMaterial color="#efeae0" />
        </mesh>
        <Sconce position={[-1.85, 2.25, 0]} />
        <Sconce position={[0, 2.3, 0]} />
        <Sconce position={[1.85, 2.25, 0]} />
      </group>

      {/* Linkerwand: hoge ramen met groene gordijnen */}
      <group position={[-W / 2, 0, 0]} rotation-y={Math.PI / 2}>
        <mesh position={[0, H / 2, 0]}>
          <planeGeometry args={[D, H]} />
          <meshStandardMaterial color={OCHRE} roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.45, 0.02]}>
          <boxGeometry args={[D, 0.9, 0.04]} />
          <meshStandardMaterial color={PANEL} />
        </mesh>
        {[-1.2, 0.6].map((z) => (
          <group key={z} position={[z, 1.85, 0.03]}>
            <mesh>
              <boxGeometry args={[1.3, 1.9, 0.04]} />
              <meshStandardMaterial color={WOOD_DARK} />
            </mesh>
            {[-0.3, 0.3].map((px) =>
              [-0.45, 0.45].map((py) => (
                <mesh key={`${px}${py}`} position={[px, py, 0.03]}>
                  <planeGeometry args={[0.52, 0.82]} />
                  <meshStandardMaterial
                    color="#1a2438"
                    emissive="#2b3d63"
                    emissiveIntensity={0.35}
                    roughness={0.1}
                    metalness={0.3}
                  />
                </mesh>
              )),
            )}
            {[-0.78, 0.78].map((cx) => (
              <mesh key={cx} position={[cx, -0.05, 0.12]}>
                <boxGeometry args={[0.3, 2.3, 0.1]} />
                <meshStandardMaterial color={CURTAIN} roughness={1} />
              </mesh>
            ))}
          </group>
        ))}
        <pointLight position={[0, 2, 0.6]} intensity={0.6} distance={3} color="#7f95c9" />
      </group>

      {/* Rechterwand: donkere houten kast/deur */}
      <group position={[W / 2, 0, 0]} rotation-y={-Math.PI / 2}>
        <mesh position={[0, H / 2, 0]}>
          <planeGeometry args={[D, H]} />
          <meshStandardMaterial color={OCHRE} roughness={0.95} />
        </mesh>
        <mesh position={[0.6, 1.4, 0.2]}>
          <boxGeometry args={[1.5, 2.8, 0.4]} />
          <meshStandardMaterial color="#1e140d" roughness={0.6} />
        </mesh>
        <mesh position={[-1.4, 0.7, 0.03]}>
          <boxGeometry args={[2.4, 1.4, 0.06]} />
          <meshStandardMaterial color={PANEL} />
        </mesh>
        <Sconce position={[-1.4, 2.2, 0]} />
      </group>

      {/* Achter jou (niet in beeld, wel licht) */}
      <mesh position={[0, H / 2, D / 2]} rotation-y={Math.PI}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color={OCHRE} />
      </mesh>

      <GameTable />
      <SideTable position={[-2.1, 0, -1.6]} />
      <SideTable position={[1.9, 0, -1.7]} />
      <Barrel position={[2.2, 0, 0.2]} />
    </group>
  );
}
