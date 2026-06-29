import profile from "@/data/profile.json";
import type { CandidateProfile } from "@/lib/types";

export function getProfile() {
  return profile as CandidateProfile;
}
