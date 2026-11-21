"""Verify Authenticode presence: parse PE optional header DataDirectory[4]
(Certificate Table). size > 0 => the file carries an Authenticode signature."""
import struct
import sys

data = open(sys.argv[1], "rb").read()
pe = struct.unpack_from("<I", data, 0x3C)[0]
assert data[pe:pe + 4] == b"PE\0\0", "not a PE file"
opt = pe + 24
magic = struct.unpack_from("<H", data, opt)[0]
dd_off = opt + (112 if magic == 0x20B else 96)
rva, size = struct.unpack_from("<II", data, dd_off + 4 * 8)
print("Certificate Table: offset=%d size=%d" % (rva, size))
print("=> AUTHENTICODE SIGNED" if size > 0 else "=> NOT SIGNED")
