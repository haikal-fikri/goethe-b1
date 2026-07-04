import React, { useRef } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { AppText } from "./ui";
import type { Tile } from "@repo/core";

// „Wörter ordnen" per Drag & Drop (Nutzeranforderung): Kacheln aus der Wortbank in die
// Antwort ziehen, in der Antwort per Drag umsortieren, aus der Antwort ziehen → entfernen.
// Tippen bleibt als barrierefreier Fallback (Wortbank-Kachel → anfügen, platzierte Kachel →
// entfernen). Baut auf react-native-gesture-handler + reanimated (Frame-Messung via
// measureInWindow; die Screens sind Fixed-Layout ohne Scroll → Fensterkoordinaten stabil).
type Frame = { x: number; y: number; w: number; h: number };

export function WordArrange({ pool, placed, onChange, locked, color, result }: {
  pool: Tile[];
  placed: Tile[];
  onChange: (next: Tile[]) => void;
  locked: boolean;
  color: string;
  result: boolean | null;
}) {
  const { c, radius } = useTheme();
  const active = !locked && result === null;
  const usedIds = new Set(placed.map((t) => t.id));
  const available = pool.filter((t) => !usedIds.has(t.id));

  const frames = useRef<Map<string, Frame>>(new Map());
  const wellFrame = useRef<Frame | null>(null);
  const wellRef = useRef<View>(null);

  const inWell = (px: number, py: number): boolean => {
    const f = wellFrame.current;
    if (!f) return false;
    const pad = 24;
    return px >= f.x - pad && px <= f.x + f.w + pad && py >= f.y - pad && py <= f.y + f.h + pad;
  };

  // Einfügeindex aus dem Drop-Punkt (wrap-bewusst: grobe Zeile über y, dann x).
  const insertionIndex = (px: number, py: number, exclude?: string): number => {
    const ROW = 44;
    const scalar = (x: number, y: number) => Math.round(y / ROW) * 100000 + x;
    const ps = scalar(px, py);
    let idx = 0;
    for (const t of placed) {
      if (t.id === exclude) continue;
      const f = frames.current.get(t.id);
      if (f && scalar(f.x + f.w / 2, f.y + f.h / 2) < ps) idx++;
    }
    return idx;
  };

  const handleDrop = (tile: Tile, fromPlaced: boolean, px: number, py: number) => {
    if (!active) return;
    const over = inWell(px, py);
    if (fromPlaced) {
      const without = placed.filter((t) => t.id !== tile.id);
      if (!over) { onChange(without); return; } // aus der Antwort gezogen → entfernen
      const idx = Math.min(insertionIndex(px, py, tile.id), without.length);
      onChange([...without.slice(0, idx), tile, ...without.slice(idx)]);
    } else {
      if (!over) return; // Wortbank-Kachel außerhalb der Antwort → zurückschnappen
      const idx = Math.min(insertionIndex(px, py), placed.length);
      onChange([...placed.slice(0, idx), tile, ...placed.slice(idx)]);
    }
  };

  const tap = (tile: Tile, fromPlaced: boolean) => {
    if (!active) return;
    if (fromPlaced) onChange(placed.filter((t) => t.id !== tile.id));
    else onChange([...placed, tile]);
  };

  const setFrame = (id: string, ref: View | null) => {
    ref?.measureInWindow((x, y, w, h) => frames.current.set(id, { x, y, w, h }));
  };

  return (
    <>
      {/* Antwort-Well (Drop-Zone) */}
      <View
        ref={wellRef}
        onLayout={() => wellRef.current?.measureInWindow((x, y, w, h) => (wellFrame.current = { x, y, w, h }))}
        style={{ minHeight: 60, marginTop: 12, borderWidth: 1.5, borderStyle: "dashed", borderColor: c.borderStrong, borderRadius: radius.tile, padding: 10, flexDirection: "row", flexWrap: "wrap", gap: 8, backgroundColor: c.surfaceSunken }}
      >
        {placed.map((t) => (
          <DragTile key={t.id} tile={t} fromPlaced enabled={active} color={result === false ? "#D6463C" : color}
            filled radius={radius.tile} textColor="#fff" borderColor="transparent" surface={c.surface}
            onMeasure={setFrame} onDrop={handleDrop} onTap={tap} />
        ))}
      </View>

      {/* Wortbank (nur solange nicht geprüft) */}
      {result === null && (
        <>
          <AppText size={12.5} color={c.textMuted} style={{ marginTop: 16, marginBottom: 8 }}>Wortbank · ziehen oder tippen</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {available.map((t) => (
              <DragTile key={t.id} tile={t} fromPlaced={false} enabled={active} color={color}
                filled={false} radius={radius.tile} textColor={c.textHi} borderColor={c.border} surface={c.surface}
                onMeasure={setFrame} onDrop={handleDrop} onTap={tap} />
            ))}
          </View>
        </>
      )}
    </>
  );
}

function DragTile({ tile, fromPlaced, enabled, color, filled, radius, textColor, borderColor, surface, onMeasure, onDrop, onTap }: {
  tile: Tile; fromPlaced: boolean; enabled: boolean; color: string; filled: boolean; radius: number;
  textColor: string; borderColor: string; surface: string;
  onMeasure: (id: string, ref: View | null) => void;
  onDrop: (tile: Tile, fromPlaced: boolean, px: number, py: number) => void;
  onTap: (tile: Tile, fromPlaced: boolean) => void;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const lifted = useSharedValue(0);
  const ref = useRef<View>(null);

  const pan = Gesture.Pan()
    .enabled(enabled)
    .minDistance(8)
    .onBegin(() => { lifted.value = 1; })
    .onUpdate((e) => { tx.value = e.translationX; ty.value = e.translationY; })
    .onEnd((e) => {
      runOnJS(onDrop)(tile, fromPlaced, e.absoluteX, e.absoluteY);
      tx.value = withTiming(0, { duration: 140 });
      ty.value = withTiming(0, { duration: 140 });
      lifted.value = 0;
    })
    .onFinalize(() => { lifted.value = 0; });

  const tapG = Gesture.Tap().enabled(enabled).onEnd(() => runOnJS(onTap)(tile, fromPlaced));
  const gesture = Gesture.Exclusive(pan, tapG);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: withTiming(lifted.value ? 1.06 : 1, { duration: 120 }) }],
    zIndex: lifted.value ? 20 : 0,
    elevation: lifted.value ? 8 : 0,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View ref={ref} onLayout={() => onMeasure(tile.id, ref.current)} style={style}>
        <View style={{
          paddingHorizontal: 12, paddingVertical: filled ? 8 : 9, borderRadius: radius,
          backgroundColor: filled ? color : surface, borderWidth: filled ? 0 : 1, borderColor,
        }}>
          <AppText role="uiSemi" size={15} color={filled ? textColor : textColor}>{tile.label}</AppText>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
