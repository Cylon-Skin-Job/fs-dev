import Foundation
import CoreGraphics
let pid=57401
let windows=CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String:Any]] ?? []
let selected=windows.filter { ($0[kCGWindowOwnerPID as String] as? Int)==pid }.map { w -> [String:Any] in
 var v:[String:Any]=["ownerPid":pid]
 for k in [kCGWindowNumber,kCGWindowBounds,kCGWindowLayer,kCGWindowIsOnscreen,kCGWindowOwnerName,kCGWindowName] { if let value=w[k as String] { v[k as String]=value } }
 return v
}
let result:[String:Any]=["readOnly":true,"mainPid":pid,"windows":selected]
let data=try JSONSerialization.data(withJSONObject:result, options:[.prettyPrinted,.sortedKeys])
print(String(data:data,encoding:.utf8)!)
