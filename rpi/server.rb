require 'rubygems'
require 'socket.io-client-simple'
require 'pi_piper'
include PiPiper

socket = SocketIO::Client::Simple.connect 'http://thox.org'
redPin = PiPiper::Pin.new(:pin => 23, :direction => :out)
bluePin = PiPiper::Pin.new(:pin => 24, :direction => :out)

socket.on :connect do
        socket.emit "rpi auth", {:password => "I AM A RASPBERRY PI"}
end

socket.on "add water" do |data|
        if data["player"] == 'red'
                Thread.new do
                        redPin.on
                        sleep 0.95
                        redPin.off
                end
        else
                Thread.new do
                        bluePin.on
                        sleep 0.95
                        bluePin.off
                end
        end
end

socket.on "EMERGENCY STOP JESUS SHUT IT ALL DOWN" do
        redPin.off
        bluePin.off
end


loop do
end

