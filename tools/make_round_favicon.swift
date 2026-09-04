import AppKit
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
guard let image = NSImage(contentsOf: inputURL),
      let source = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  fatalError("Could not load source image")
}

let size = 256
let colorSpace = CGColorSpaceCreateDeviceRGB()
guard let context = CGContext(
  data: nil,
  width: size,
  height: size,
  bitsPerComponent: 8,
  bytesPerRow: size * 4,
  space: colorSpace,
  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
  fatalError("Could not create image context")
}

context.clear(CGRect(x: 0, y: 0, width: size, height: size))
context.addEllipse(in: CGRect(x: 4, y: 4, width: size - 8, height: size - 8))
context.clip()
context.interpolationQuality = .high
context.draw(source, in: CGRect(x: 4, y: 4, width: size - 8, height: size - 8))

guard let output = context.makeImage(),
      let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.png.identifier as CFString, 1, nil) else {
  fatalError("Could not create PNG destination")
}
CGImageDestinationAddImage(destination, output, nil)
guard CGImageDestinationFinalize(destination) else {
  fatalError("Could not save PNG")
}
