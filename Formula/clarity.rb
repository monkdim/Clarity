class Clarity < Formula
  desc "Simple code. Real power. A modern programming language."
  homepage "https://github.com/monkdim/Clarity"
  version "1.0.0"
  license "GPL-3.0-only"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/monkdim/Clarity/releases/download/v#{version}/clarity-darwin-arm64.tar.gz"
      sha256 "PLACEHOLDER"
    else
      url "https://github.com/monkdim/Clarity/releases/download/v#{version}/clarity-darwin-x64.tar.gz"
      sha256 "PLACEHOLDER"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/monkdim/Clarity/releases/download/v#{version}/clarity-linux-arm64.tar.gz"
      sha256 "PLACEHOLDER"
    else
      url "https://github.com/monkdim/Clarity/releases/download/v#{version}/clarity-linux-x64.tar.gz"
      sha256 "PLACEHOLDER"
    end
  end

  def install
    bin.install "clarity"
  end

  test do
    assert_match "1.0.0", shell_output("#{bin}/clarity version")
  end
end
