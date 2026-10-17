'use client';

import React from 'react';
import { motion } from 'motion/react';
import { X, CheckCircle, Crosshair, Zap, Award } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-[#FAF6EF] border-2 border-[#D5CCBC] rounded-2xl p-6 shadow-xl relative max-h-[90vh] overflow-y-auto text-[#1F1C19]"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#6B635A] hover:text-[#1F1C19] hover:bg-[#EFE8DC] rounded-lg transition-colors border border-transparent hover:border-[#D5CCBC]"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-black text-[#1F1C19] mb-1.5">
          Luật Chơi Cờ Vây Kẹp Quân
        </h3>
        <p className="text-xs text-[#6B635A] mb-5">
          Quy tắc đơn giản, chiến thuật phong phú trên kỳ bàn 8x8.
        </p>

        <div className="space-y-3">
          {/* Rule 1 */}
          <div className="flex items-start gap-3 p-3 bg-[#F2ECE0] rounded-xl border border-[#DDD3C2]">
            <div className="p-2 rounded-lg bg-[#FAF6EF] border border-[#D5CCBC] text-[#A83226] shrink-0">
              <Crosshair className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-[#1F1C19] text-xs">1. Khởi đầu trận đấu</h4>
              <p className="text-xs text-[#524B43] mt-1 leading-relaxed">
                Trận đấu bắt đầu với <strong>4 quân cờ</strong> (2 quân Đen và 2 quân Trắng) được xếp chéo nhau tại 4 điểm giao cắt trung tâm của bàn cờ. Quân Đen được đi trước.
              </p>
            </div>
          </div>

          {/* Rule 2 */}
          <div className="flex items-start gap-3 p-3 bg-[#F2ECE0] rounded-xl border border-[#DDD3C2]">
            <div className="p-2 rounded-lg bg-[#FAF6EF] border border-[#D5CCBC] text-[#A83226] shrink-0">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-[#1F1C19] text-xs">2. Đặt quân tùy ý</h4>
              <p className="text-xs text-[#524B43] mt-1 leading-relaxed">
                Người chơi luân phiên nhau đặt quân cờ của mình vào <strong>bất kỳ điểm giao cắt còn trống nào</strong> trên bàn cờ. Nếu nước đi chưa kẹp được quân đối phương, quân cờ vẫn nằm yên tại vị trí đó để tạo thế chặn và phối hợp cho các lượt tiếp theo.
              </p>
            </div>
          </div>

          {/* Rule 3 */}
          <div className="flex items-start gap-3 p-3 bg-[#F2ECE0] rounded-xl border border-[#DDD3C2]">
            <div className="p-2 rounded-lg bg-[#FAF6EF] border border-[#D5CCBC] text-[#A83226] shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-[#1F1C19] text-xs">3. Kẹp quân và lật cờ</h4>
              <p className="text-xs text-[#524B43] mt-1 leading-relaxed">
                Khi bạn đặt quân làm cho <strong>1 hoặc nhiều quân đối phương bị chặn 2 đầu</strong> theo chiều ngang, chiều dọc hoặc đường chéo giữa quân vừa đặt và một quân cùng màu đã có từ trước, <strong>toàn bộ các quân bị kẹp sẽ biến thành màu quân của bạn!</strong>
              </p>
            </div>
          </div>

          {/* Rule 4 */}
          <div className="flex items-start gap-3 p-3 bg-[#F2ECE0] rounded-xl border border-[#DDD3C2]">
            <div className="p-2 rounded-lg bg-[#FAF6EF] border border-[#D5CCBC] text-[#A83226] shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-[#1F1C19] text-xs">4. Điều kiện chiến thắng</h4>
              <p className="text-xs text-[#524B43] mt-1 leading-relaxed">
                Ván cờ kết thúc khi <strong>bàn cờ không còn chỗ trống</strong> hoặc cả hai kỳ thủ đều không còn nước đi hợp lệ. Người chơi có <strong>số lượng quân cờ cao hơn</strong> sẽ giành chiến thắng!
              </p>
            </div>
          </div>

          {/* Rule 5 - 45s Timeout */}
          <div className="flex items-start gap-3 p-3 bg-[#FBEBE8] rounded-xl border border-[#F2C2BB]">
            <div className="p-2 rounded-lg bg-[#FAF6EF] border border-[#E8ABA4] text-[#A83226] shrink-0">
              <span className="text-sm">⏱️</span>
            </div>
            <div>
              <h4 className="font-bold text-[#A83226] text-xs">5. Giới hạn thời gian 45 giây / lượt</h4>
              <p className="text-xs text-[#524B43] mt-1 leading-relaxed">
                Mỗi lượt đánh có tối đa <strong>45 giây</strong> suy nghĩ. Nếu quá 45 giây mà chưa hoàn tất nước đi, kỳ thủ đến lượt sẽ <strong>bị xử thua ngay lập tức</strong>!
              </p>
            </div>
          </div>
        </div>

        {/* Tip Box */}
        <div className="mt-4 p-3 bg-[#FCFAF5] rounded-xl border border-[#D5CCBC] text-xs text-[#524B43]">
          💡 <strong>Mẹo chiến thuật:</strong> 4 góc bàn cờ là những vị trí vàng không bao giờ bị đối phương lật lại. Hãy cố gắng kiểm soát các góc để xây dựng thế trận vững chắc.
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 bg-[#A83226] hover:bg-[#93291F] text-white font-bold text-xs rounded-xl transition-colors border border-[#7A2118] shadow-xs"
        >
          Đã hiểu, sẵn sàng thi đấu
        </button>
      </motion.div>
    </div>
  );
};
