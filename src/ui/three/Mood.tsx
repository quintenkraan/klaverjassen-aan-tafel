import { Environment, Lightformer } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useMemo } from 'react';
import { isLite } from './support';

/**
 * Sfeer van een bruin café:
 * - reflecties: een kleine, zelfgemaakte omgeving (warme lampen, blauwig raamlicht) waar messing,
 *   glas en de gelakte bar in spiegelen; geen download nodig
 * - gloed rond lampen, kaarsjes en neon (bloom)
 * - zachte schaduw in hoeken en onder tafels (ambient occlusion, alleen op computers)
 * - filmische kleurweergave en donkere randen (vignet); geen extra kleurfilter, dat maakt
 *   felle kleuren (bier, lampen) zwart
 */
export function Mood() {
  const lite = useMemo(isLite, []);
  return (
    <>
      <Environment resolution={lite ? 64 : 128} frames={1} environmentIntensity={0.55}>
        <color attach="background" args={['#1a110b']} />
        {/* Bollampen boven de bar */}
        {[-4, -1, 2].map((z) => (
          <Lightformer
            key={z}
            form="circle"
            intensity={3}
            color="#ffd9a6"
            position={[-0.9, 2.4, z]}
            scale={0.6}
          />
        ))}
        {/* Achterbar met lichtjes */}
        <Lightformer intensity={1.2} color="#ffb867" position={[0.6, 1.8, 0]} scale={[0.2, 1, 9]} />
        {/* Ramen: koel straatlicht */}
        <Lightformer
          intensity={0.8}
          color="#7f95c9"
          position={[-3.9, 1.8, -5]}
          rotation-y={Math.PI / 2}
          scale={[4, 1.8, 1]}
        />
        {/* Warm plafond */}
        <Lightformer
          intensity={0.4}
          color="#8a5a32"
          position={[0, 3.1, 0]}
          rotation-x={Math.PI / 2}
          scale={[8, 18, 1]}
        />
      </Environment>
      <EffectComposer multisampling={lite ? 0 : 4} enableNormalPass={false}>
        <>{!lite && <N8AO halfRes aoRadius={0.35} distanceFalloff={0.5} intensity={1.3} />}</>
        <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.15} intensity={0.9} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.32} darkness={0.55} />
      </EffectComposer>
    </>
  );
}
