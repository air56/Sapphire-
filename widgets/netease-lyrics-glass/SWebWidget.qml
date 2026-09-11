import QtQuick 2.15
import QtWebEngine
import QtWebChannel
import "qrc:/resources/widgets/common" as Common

Common.SWidget {
    id: root
    objectName: "NeteaseLyricsGlass"
    property var webBridge: null
    property string appPath: Qt.resolvedUrl(".")
    property string theme: root.styleThemeColor
    property bool editMode: root.currentOperationMode === "edit"
    property url webUrl: Qt.resolvedUrl("index.html")

    WebEngineView {
        id: webView
        anchors.fill: parent
        z: 10
        backgroundColor: "transparent"
        profile: globalWebEngineProfile
        enabled: !root.editMode
        url: root.webUrl
        WebChannel {
            id: channel
            Component.onCompleted: {
                if (root.webBridge) channel.registerObject("bridge", root.webBridge)
            }
        }
        webChannel: channel
        Connections {
            target: root
            function onWebBridgeChanged() {
                if (root.webBridge) channel.registerObject("bridge", root.webBridge)
            }
        }
    }

    Rectangle {
        anchors.fill: parent
        z: 20
        visible: root.editMode
        color: "transparent"
    }
}
