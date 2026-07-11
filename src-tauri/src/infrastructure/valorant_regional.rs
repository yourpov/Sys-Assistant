pub const CLIENT_PLATFORM: &str = "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9";

pub const UNKNOWN_PLAYER_NAME: &str = "Unknown";
pub const UNKNOWN_PLAYER_TAG: &str  = "????";

pub fn normalize_region(region: &str) -> String {
    match region.to_lowercase().as_str() {
        "eu" | "euw" | "eune" | "eun" | "tr" | "ru" => "eu",
        "ap" | "oce" | "sea" | "th" | "sg" | "tw" | "vn" | "id" | "ph" | "jp" => "ap",
        "latam" | "la1" | "la2" => "latam",
        "br" | "br1" => "br",
        "kr" => "kr",
        _ => "na",
    }
    .to_string()
}

pub fn shard_for_region(region: &str) -> String {
    match region {
        "latam" | "br" => "na",
        other => other,
    }
    .to_string()
}