import { useEffect, useState } from "react";
import {
  setNotesEnabled,
  setIcdasEnabled,
  setPulpDetailLevel,
  setSecondaryCariesMode,
  setRootCariesMode,
  setRadiographicDepthMode,
  setCariesDepthEnabled,
  setWearDetailLevel,
  setDiscolorationDetailLevel,
  setSurfaceNotation,
  getDiagnosisCodingPack,
  getSnomedEnabled,
  onStateChange,
  type PulpDetailLevel,
  type SecondaryCariesMode,
  type RootCariesMode,
  type RadiographicDepthMode,
  type ToothDetailLevel,
  type SurfaceNotation,
} from "@/odontogram";

export function useClinicalSettingsState({
  enableNotes,
  enableIcdas,
  pulpDetailLevel,
  secondaryCariesMode,
  rootCariesMode,
  radiographicDepthMode,
  cariesDepthEnabled,
  wearDetailLevel,
  discolorationDetailLevel,
  surfaceNotation,
}: {
  enableNotes?: boolean;
  enableIcdas?: boolean;
  pulpDetailLevel?: PulpDetailLevel;
  secondaryCariesMode?: SecondaryCariesMode;
  rootCariesMode?: RootCariesMode;
  radiographicDepthMode?: RadiographicDepthMode;
  cariesDepthEnabled?: boolean;
  wearDetailLevel?: ToothDetailLevel;
  discolorationDetailLevel?: ToothDetailLevel;
  surfaceNotation?: SurfaceNotation;
}) {
  const [notesOn, setNotesOn] = useState<boolean>(enableNotes ?? false);
  const [icdasOn, setIcdasOn] = useState<boolean>(enableIcdas ?? false);
  const [pulpLevel, setPulpLevel] = useState<PulpDetailLevel>(pulpDetailLevel ?? "aae");
  const [secondaryMode, setSecondaryMode] = useState<SecondaryCariesMode>(secondaryCariesMode ?? "standard");
  const [rootMode, setRootMode] = useState<RootCariesMode>(rootCariesMode ?? "simple");
  const [radiographicMode, setRadiographicMode] = useState<RadiographicDepthMode>(radiographicDepthMode ?? "off");
  const [cariesDepthOn, setCariesDepthOn] = useState<boolean>(cariesDepthEnabled ?? true);
  const [wearLevel, setWearLevel] = useState<ToothDetailLevel>(wearDetailLevel ?? "complex");
  const [discoLevel, setDiscoLevel] = useState<ToothDetailLevel>(discolorationDetailLevel ?? "complex");
  const [notation, setNotation] = useState<SurfaceNotation>(surfaceNotation ?? "full");
  const [codingPack, setCodingPackState] = useState<string>(() => getDiagnosisCodingPack());
  const [snomedEnabled, setSnomedEnabledState] = useState<boolean>(() => getSnomedEnabled());

  useEffect(() => {
    setNotesEnabled(enableNotes ?? false);
    setNotesOn(enableNotes ?? false);
  }, [enableNotes]);

  useEffect(() => {
    setIcdasEnabled(enableIcdas ?? false);
    setIcdasOn(enableIcdas ?? false);
  }, [enableIcdas]);

  useEffect(() => {
    setPulpDetailLevel(pulpDetailLevel ?? "aae");
    setPulpLevel(pulpDetailLevel ?? "aae");
  }, [pulpDetailLevel]);

  useEffect(() => {
    const v = secondaryCariesMode ?? "standard";
    setSecondaryCariesMode(v);
    setSecondaryMode(v);
  }, [secondaryCariesMode]);

  useEffect(() => {
    const v = rootCariesMode ?? "simple";
    setRootCariesMode(v);
    setRootMode(v);
  }, [rootCariesMode]);

  useEffect(() => {
    const v = radiographicDepthMode ?? "off";
    setRadiographicDepthMode(v);
    setRadiographicMode(v);
  }, [radiographicDepthMode]);

  useEffect(() => {
    const v = cariesDepthEnabled ?? true;
    setCariesDepthEnabled(v);
    setCariesDepthOn(v);
  }, [cariesDepthEnabled]);

  useEffect(() => {
    const v = wearDetailLevel ?? "complex";
    setWearDetailLevel(v);
    setWearLevel(v);
  }, [wearDetailLevel]);

  useEffect(() => {
    const v = discolorationDetailLevel ?? "complex";
    setDiscolorationDetailLevel(v);
    setDiscoLevel(v);
  }, [discolorationDetailLevel]);

  useEffect(() => {
    const v = surfaceNotation ?? "full";
    setSurfaceNotation(v);
    setNotation(v);
  }, [surfaceNotation]);

  useEffect(() => {
    const refresh = () => setCodingPackState(getDiagnosisCodingPack());
    refresh();
    return onStateChange(refresh);
  }, []);

  useEffect(() => {
    const refresh = () => setSnomedEnabledState(getSnomedEnabled());
    refresh();
    return onStateChange(refresh);
  }, []);

  return {
    notesOn,
    setNotesOn,
    icdasOn,
    setIcdasOn,
    pulpLevel,
    setPulpLevel,
    secondaryMode,
    setSecondaryMode,
    rootMode,
    setRootMode,
    radiographicMode,
    setRadiographicMode,
    cariesDepthOn,
    setCariesDepthOn,
    wearLevel,
    setWearLevel,
    discoLevel,
    setDiscoLevel,
    notation,
    setNotation,
    codingPack,
    snomedEnabled,
  };
}
