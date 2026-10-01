use std::env;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();

    if target_os == "macos" {
        let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
        let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
        let swift_src_dir = manifest_dir.join("macos").join("NearShareDirect");

        let swift_files = vec![
            swift_src_dir.join("NearShareDirectTypes.swift"),
            swift_src_dir.join("NearShareDirectPeer.swift"),
            swift_src_dir.join("NearShareDirectSession.swift"),
            swift_src_dir.join("NearShareDirectBridge.swift"),
        ];

        let lib_path = out_dir.join("libnearshare_direct.a");

        println!("cargo:rerun-if-changed={}", swift_src_dir.display());

        let mut cmd = Command::new("swiftc");
        cmd.arg("-emit-library")
            .arg("-static")
            .arg("-module-name")
            .arg("NearShareDirect")
            .arg("-o")
            .arg(&lib_path);

        for file in &swift_files {
            cmd.arg(file);
        }

        cmd.arg("-framework")
            .arg("MultipeerConnectivity")
            .arg("-framework")
            .arg("Foundation")
            .arg("-framework")
            .arg("Network");

        let status = cmd.status().expect("Failed to execute swiftc to build NearShareDirect");
        if !status.success() {
            panic!("swiftc failed to compile NearShareDirect native module");
        }

        println!("cargo:rustc-link-search=native={}", out_dir.display());
        println!("cargo:rustc-link-lib=static=nearshare_direct");
        println!("cargo:rustc-link-lib=framework=MultipeerConnectivity");
        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rustc-link-lib=framework=Network");
    }

    tauri_build::build();
}
